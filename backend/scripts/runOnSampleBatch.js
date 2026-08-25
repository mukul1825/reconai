/**
 * scripts/runOnSampleBatch.js
 *
 * Bridges the Python-generated dataset with the Node matching engine: reads
 * the real sample_batch CSVs, runs the exact-match engine against them, and
 * checks the results against ground_truth.json category by category.
 *
 * This is NOT the official evaluate.py (that's Day 11, and will report
 * precision/recall for the FULL matching pipeline including fuzzy + split).
 * This is a sanity-check script for today: proof the exact-match engine
 * behaves exactly as designed against real data, not just hand-crafted
 * unit test fixtures.
 *
 * Usage (from backend/):
 *   node scripts/runOnSampleBatch.js
 */

const fs = require("fs");
const path = require("path");
const { parseLedgerCsv, parseSettlementCsv, parseBankCsv } = require("../src/services/matching/parseCsv");
const { runExactMatch } = require("../src/services/matching/exactMatch");

const dataDir = path.join(__dirname, "..", "..", "data", "sample_batch");

const ledger = parseLedgerCsv(fs.readFileSync(path.join(dataDir, "ledger.csv"), "utf-8"));
const settlement = parseSettlementCsv(fs.readFileSync(path.join(dataDir, "settlement_report.csv"), "utf-8"));
const bank = parseBankCsv(fs.readFileSync(path.join(dataDir, "bank_statement.csv"), "utf-8"));
const groundTruth = JSON.parse(fs.readFileSync(path.join(dataDir, "ground_truth.json"), "utf-8"));

const { matches, unmatched, warnings } = runExactMatch({ ledger, settlement, bank });

const matchedOrderIds = new Set(matches.map((m) => m.orderId));

// Break down matched/unmatched by ground-truth category
const byCategory = {};
for (const entry of groundTruth.orders) {
  const cat = entry.category;
  byCategory[cat] = byCategory[cat] || { total: 0, matchedByEngine: 0 };
  byCategory[cat].total += 1;
  if (matchedOrderIds.has(entry.order_id)) {
    byCategory[cat].matchedByEngine += 1;
  }
}

console.log(`\n=== Exact-Match Engine vs Ground Truth (n=${groundTruth.n_orders}, seed=${groundTruth.seed}) ===\n`);
console.log(`Total ledger orders: ${ledger.length}`);
console.log(`Auto-matched by exact engine: ${matches.length}`);
console.log(`Left unmatched (correctly deferred to Day 5 logic): ${unmatched.length}`);
console.log(`Duplicate-entry warnings caught: ${warnings.length}\n`);

console.log("Breakdown by ground-truth category:");
console.log("category            total   matched-by-exact-engine   %");
for (const [cat, stats] of Object.entries(byCategory)) {
  const pct = ((100 * stats.matchedByEngine) / stats.total).toFixed(1);
  console.log(
    `${cat.padEnd(18)}  ${String(stats.total).padStart(5)}   ${String(stats.matchedByEngine).padStart(5)}                    ${pct}%`
  );
}

console.log("\nExpected result, by design:");
console.log("  exact             -> ~100% (this engine's whole job)");
console.log("  duplicate         -> ~100% (handled here - see exactMatch.js docstring)");
console.log("  fee_mismatch      -> 0%   (correctly deferred - needs Day 5 fuzzy logic)");
console.log("  split_settlement  -> 0%   (correctly deferred - needs Day 5 split logic)");
console.log("  delayed_missing   -> 0%   (correctly deferred - not an error, just not yet matchable)");

// Fail loudly if exact/duplicate categories aren't fully resolved - that
// would mean a real bug in the engine, not an expected limitation.
const exactOk = byCategory.exact && byCategory.exact.matchedByEngine === byCategory.exact.total;
const dupOk = byCategory.duplicate && byCategory.duplicate.matchedByEngine === byCategory.duplicate.total;

if (!exactOk || !dupOk) {
  console.error("\n[FAIL] exact or duplicate category is not fully resolved - investigate before moving to Day 5.");
  process.exit(1);
} else {
  console.log("\n[PASS] exact and duplicate categories are fully resolved by the exact-match engine, as designed.");
}
