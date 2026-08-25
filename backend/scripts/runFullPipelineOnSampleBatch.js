/**
 * scripts/runFullPipelineOnSampleBatch.js
 *
 * Runs the FULL matching pipeline (exact + fuzzy + split + decision policy)
 * against the real generated dataset and checks results against
 * ground_truth.json, category by category. This is Day 5's proof - not the
 * official evaluate.py (Day 11, which will report precision/recall properly)
 * but a concrete sanity check that today's work does what it claims.
 *
 * Usage (from backend/): node scripts/runFullPipelineOnSampleBatch.js
 */

const fs = require("fs");
const path = require("path");
const { parseLedgerCsv, parseSettlementCsv, parseBankCsv } = require("../src/services/matching/parseCsv");
const { runFullMatchingPipeline } = require("../src/services/matching/matchAll");

const dataDir = path.join(__dirname, "..", "..", "data", "sample_batch");

const ledger = parseLedgerCsv(fs.readFileSync(path.join(dataDir, "ledger.csv"), "utf-8"));
const settlement = parseSettlementCsv(fs.readFileSync(path.join(dataDir, "settlement_report.csv"), "utf-8"));
const bank = parseBankCsv(fs.readFileSync(path.join(dataDir, "bank_statement.csv"), "utf-8"));
const groundTruth = JSON.parse(fs.readFileSync(path.join(dataDir, "ground_truth.json"), "utf-8"));

const { results, warnings, summary } = runFullMatchingPipeline({ ledger, settlement, bank });

const resultByOrderId = new Map(results.map((r) => [r.orderId, r]));

const byCategory = {};
for (const entry of groundTruth.orders) {
  const cat = entry.category;
  const result = resultByOrderId.get(entry.order_id);
  byCategory[cat] = byCategory[cat] || { total: 0, resolvedNonAuto: 0, autoResolved: 0, matchTypes: {} };
  byCategory[cat].total += 1;
  if (result.recommendedAction === "auto_resolve") {
    byCategory[cat].autoResolved += 1;
  } else if (result.matchType !== "none") {
    byCategory[cat].resolvedNonAuto += 1; // matched, but routed to a human (e.g. escalate_high_value)
  }
  byCategory[cat].matchTypes[result.matchType] = (byCategory[cat].matchTypes[result.matchType] || 0) + 1;
}

console.log(`\n=== Full Pipeline vs Ground Truth (n=${groundTruth.n_orders}, seed=${groundTruth.seed}) ===\n`);
console.log("Overall action breakdown:", summary.byAction);
console.log("Overall match-type breakdown:", summary.byMatchType);
console.log(`Duplicate-entry warnings: ${warnings.length}\n`);

console.log("Breakdown by ground-truth category:");
console.log("category            total   auto-resolved   matched-but-routed-to-human   match types");
for (const [cat, stats] of Object.entries(byCategory)) {
  console.log(
    `${cat.padEnd(18)}  ${String(stats.total).padStart(5)}   ${String(stats.autoResolved).padStart(6)}          ${String(stats.resolvedNonAuto).padStart(6)}                      ${JSON.stringify(stats.matchTypes)}`
  );
}

console.log("\nExpected result, by design:");
console.log("  exact             -> ~100% auto_resolve, matchType exact");
console.log("  duplicate         -> ~100% auto_resolve, matchType exact");
console.log("  fee_mismatch      -> resolved via matchType fuzzy (auto_resolve or escalate, depending on amount)");
console.log("  split_settlement  -> resolved via matchType split (auto_resolve or escalate, depending on amount)");
console.log("  delayed_missing   -> matchType none, never auto_resolve (correctly deferred to a human)");

// Correctness checks - fail loudly if the pipeline doesn't behave as designed.
let failed = false;

const exactCat = byCategory.exact;
if (!exactCat || exactCat.autoResolved + exactCat.resolvedNonAuto !== exactCat.total) {
  console.error("[FAIL] not every 'exact' category order was matched.");
  failed = true;
}

const dupCat = byCategory.duplicate;
if (!dupCat || dupCat.autoResolved + dupCat.resolvedNonAuto !== dupCat.total) {
  console.error("[FAIL] not every 'duplicate' category order was matched.");
  failed = true;
}

const feeCat = byCategory.fee_mismatch;
const feeMatchedViaFuzzy = feeCat ? (feeCat.matchTypes.fuzzy || 0) : 0;
if (!feeCat || feeMatchedViaFuzzy < feeCat.total * 0.9) {
  console.error(`[FAIL] fewer than 90% of fee_mismatch orders were resolved via fuzzy matching (got ${feeMatchedViaFuzzy}/${feeCat ? feeCat.total : 0}).`);
  failed = true;
}

const splitCat = byCategory.split_settlement;
const splitMatchedViaSplit = splitCat ? (splitCat.matchTypes.split || 0) : 0;
if (!splitCat || splitMatchedViaSplit < splitCat.total * 0.9) {
  console.error(`[FAIL] fewer than 90% of split_settlement orders were resolved via split matching (got ${splitMatchedViaSplit}/${splitCat ? splitCat.total : 0}).`);
  failed = true;
}

const delayedCat = byCategory.delayed_missing;
if (!delayedCat || delayedCat.autoResolved > 0) {
  console.error("[FAIL] a delayed_missing order was incorrectly auto-resolved - this should never happen.");
  failed = true;
}

if (failed) {
  console.error("\n[FAIL] pipeline does not match the Day 5 design - investigate before moving to Day 6.");
  process.exit(1);
} else {
  console.log("\n[PASS] pipeline behaves exactly as designed across all 5 categories.");
}
