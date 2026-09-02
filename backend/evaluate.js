/**
 * evaluate.js — ReconAI reproducibility & accuracy evaluation.
 *
 * NOTE ON NAMING: the Day 1 plan called for `evaluate.py`. This is `evaluate.js`
 * instead - the entire matching engine is JavaScript (see backend/src/services/
 * matching/), and shelling out from Python to Node (or vice versa) to run it
 * would add a real failure point for zero benefit. Same category of disclosed,
 * reasoned deviation as the MongoDB-over-relational-DB choice from Day 1 -
 * documented here and in the README rather than silently done.
 *
 * WHAT THIS PROVES: runs the real matching pipeline (exact -> fuzzy -> split ->
 * decision policy - the exact code path the live app uses) against the labeled
 * synthetic dataset, and reports metrics a judge can independently reproduce
 * with one command. This is NOT the same as the pass/fail sanity checks in
 * scripts/runFullPipelineOnSampleBatch.js (Day 4/5) - those check "does the
 * design behave as intended," this reports actual precision/recall numbers
 * for the README and pitch.
 *
 * Usage (from backend/):
 *   node evaluate.js                      (uses ../data/sample_batch)
 *   node evaluate.js --dir path/to/batch  (any labeled batch dir)
 */

const fs = require("fs");
const path = require("path");
const { parseLedgerCsv, parseSettlementCsv, parseBankCsv } = require("./src/services/matching/parseCsv");
const { runFullMatchingPipeline } = require("./src/services/matching/matchAll");

function parseArgs() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  const dir = dirIndex !== -1 ? args[dirIndex + 1] : path.join(__dirname, "..", "data", "sample_batch");
  return { dir };
}

// Ground truth uses "unmatched" for the no-match case; the engine's own
// vocabulary is "none" (see Match.js). Normalizing here rather than
// renaming either one - each name is correct in its own context (ground
// truth describes an outcome in plain English; the engine names a state).
function normalizeMatchType(t) {
  return t === "unmatched" ? "none" : t;
}

function evaluate(dir) {
  const ledger = parseLedgerCsv(fs.readFileSync(path.join(dir, "ledger.csv"), "utf-8"));
  const settlement = parseSettlementCsv(fs.readFileSync(path.join(dir, "settlement_report.csv"), "utf-8"));
  const bank = parseBankCsv(fs.readFileSync(path.join(dir, "bank_statement.csv"), "utf-8"));
  const groundTruth = JSON.parse(fs.readFileSync(path.join(dir, "ground_truth.json"), "utf-8"));

  const { results, summary } = runFullMatchingPipeline({ ledger, settlement, bank });
  const resultByOrderId = new Map(results.map((r) => [r.orderId, r]));

  const MATCH_TYPES = ["exact", "fuzzy", "split", "none"];
  const confusionMatrix = {};
  for (const actual of MATCH_TYPES) {
    confusionMatrix[actual] = {};
    for (const predicted of MATCH_TYPES) confusionMatrix[actual][predicted] = 0;
  }

  const perCategory = {};
  let correctClassifications = 0;

  let autoResolveTotal = 0;
  let autoResolveCorrect = 0;

  let reconcilableTotal = 0; // ground truth expected_status === "resolved"
  let reconcilableCaught = 0; // and matchType !== "none"

  let delayedMissingAutoResolved = 0; // safety check - must stay 0

  for (const entry of groundTruth.orders) {
    const result = resultByOrderId.get(entry.order_id);
    if (!result) continue; // defensive - every ground-truth order should have a result

    const expected = normalizeMatchType(entry.expected_match_type);
    const predicted = normalizeMatchType(result.matchType);

    confusionMatrix[expected][predicted] += 1;

    const isCorrect = expected === predicted;
    if (isCorrect) correctClassifications += 1;

    perCategory[entry.category] = perCategory[entry.category] || { total: 0, correct: 0 };
    perCategory[entry.category].total += 1;
    if (isCorrect) perCategory[entry.category].correct += 1;

    if (result.recommendedAction === "auto_resolve") {
      autoResolveTotal += 1;
      if (isCorrect) autoResolveCorrect += 1;
    }

    if (entry.expected_status === "resolved") {
      reconcilableTotal += 1;
      if (predicted !== "none") reconcilableCaught += 1;
    }

    if (entry.category === "delayed_missing" && result.recommendedAction === "auto_resolve") {
      delayedMissingAutoResolved += 1;
    }
  }

  const overallAccuracy = round2((correctClassifications / groundTruth.orders.length) * 100);
  const autoResolvePrecision = autoResolveTotal > 0 ? round2((autoResolveCorrect / autoResolveTotal) * 100) : null;
  const reconciliationRecall = reconcilableTotal > 0 ? round2((reconcilableCaught / reconcilableTotal) * 100) : null;
  const safetyCheckPassed = delayedMissingAutoResolved === 0;

  return {
    datasetInfo: { dir, seed: groundTruth.seed, nOrders: groundTruth.n_orders },
    pipelineMatchRate: round2((summary.byAction.auto_resolve || 0) / summary.total * 100),
    overallAccuracy,
    perCategory: Object.fromEntries(
      Object.entries(perCategory).map(([cat, s]) => [cat, { total: s.total, correct: s.correct, accuracy: round2((s.correct / s.total) * 100) }])
    ),
    confusionMatrix,
    autoResolvePrecision,
    autoResolveTotal,
    reconciliationRecall,
    reconcilableTotal,
    safetyCheck: { delayedMissingAutoResolved, passed: safetyCheckPassed },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function printReport(r) {
  console.log(`\n=== ReconAI Evaluation — seed=${r.datasetInfo.seed}, n=${r.datasetInfo.nOrders} ===\n`);

  console.log(`Overall match-type classification accuracy: ${r.overallAccuracy}%`);
  console.log(`Live-app match rate (% auto-resolved):       ${r.pipelineMatchRate}%\n`);

  console.log("Per-category accuracy (predicted matchType === expected matchType):");
  for (const [cat, s] of Object.entries(r.perCategory)) {
    console.log(`  ${cat.padEnd(18)} ${String(s.correct).padStart(3)}/${String(s.total).padEnd(3)}  ${s.accuracy}%`);
  }

  console.log("\nConfusion matrix (rows = expected, cols = predicted):");
  const types = ["exact", "fuzzy", "split", "none"];
  console.log("             " + types.map((t) => t.padStart(7)).join(""));
  for (const actual of types) {
    const row = types.map((p) => String(r.confusionMatrix[actual][p]).padStart(7)).join("");
    console.log(`  ${actual.padEnd(9)}${row}`);
  }

  console.log(`\nAuto-resolve precision: ${r.autoResolvePrecision}% (${r.autoResolveTotal} orders auto-resolved)`);
  console.log(`  -> of everything the system resolved WITHOUT a human, this % was actually correct.`);

  console.log(`\nReconciliation recall: ${r.reconciliationRecall}% (${r.reconcilableTotal} orders were genuinely reconcilable)`);
  console.log(`  -> of orders the data actually supports matching, this % were caught (any match type).`);

  console.log(`\nSafety check — delayed_missing orders auto-resolved: ${r.safetyCheck.delayedMissingAutoResolved}`);
  console.log(`  -> ${r.safetyCheck.passed ? "[PASS]" : "[FAIL]"} a genuinely not-yet-settled order must never be auto-resolved.\n`);
}

if (require.main === module) {
  const { dir } = parseArgs();
  const results = evaluate(dir);
  printReport(results);

  const outPath = path.join(dir, "evaluation_results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Full results written to ${outPath}\n`);

  process.exit(results.safetyCheck.passed ? 0 : 1);
}

module.exports = { evaluate };
