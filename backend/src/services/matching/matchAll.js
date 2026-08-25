/**
 * Full matching pipeline orchestrator - Day 5.
 *
 * Runs exact -> fuzzy -> split, in that order (each stage only sees what the
 * previous stage couldn't resolve), then runs EVERY ledger order - matched
 * or not - through the Day 1/2 decision policy so nothing is silently
 * dropped. Every order ends up with an explicit recommendedAction, even the
 * ones nothing could resolve.
 *
 * This is the file that makes the four decisionPolicy branches
 * (auto_resolve / escalate_high_value / request_more_data / flag_for_review)
 * real for match types beyond the toy example decisionPolicy.js shipped
 * with - fuzzy and split matches now flow through the exact same policy as
 * exact matches, just with lower, type-appropriate confidence.
 */

const { runExactMatch } = require("./exactMatch");
const { runFuzzyMatch } = require("./fuzzyMatch");
const { runSplitMatch } = require("./splitMatch");
const { decideAction } = require("../scoring/decisionPolicy");

// Confidence assigned to unmatched cases that reach no matcher's resolution
// at all - low enough to always fall below the review floor, but not
// identical across reasons, since some "no match" cases are more solid
// leads than others (documented per-branch below).
const UNMATCHED_CONFIDENCE = {
  no_settlement_record_found: 0.0, // nothing to go on yet
  gap_not_fee_shaped: 0.15, // a real discrepancy, not a reporting artifact
  settlement_missing_utr: 0.5, // everything else about the record is solid
  no_bank_record_for_utr: 0.4, // likely just not landed yet, not wrong
  bank_amount_does_not_match_settlement: 0.15, // a real conflict
  multiple_conflicting_bank_records_for_utr: 0.15,
  split_amounts_do_not_reconcile: 0.15,
  split_leg_not_verifiable_against_bank: 0.35,
};

function availableFieldsFor(order, settlement) {
  const fields = ["orderId", "amount", "date"];
  if (settlement && settlement.utr) fields.push("utr");
  return fields;
}

function runFullMatchingPipeline({ ledger, settlement, bank }) {
  const exactResult = runExactMatch({ ledger, settlement, bank });

  const fuzzyCandidates = exactResult.unmatched.filter((u) => u.reason === "amount_does_not_reconcile");
  const fuzzyResult = runFuzzyMatch(fuzzyCandidates, bank);

  const splitCandidates = exactResult.unmatched.filter((u) => u.reason === "multiple_settlement_records_found");
  const splitResult = runSplitMatch(splitCandidates, bank);

  // Everything exact left unmatched EXCEPT what fuzzy/split took ownership of
  const handedToFuzzyOrSplit = new Set([
    ...fuzzyCandidates.map((c) => c.order.orderId),
    ...splitCandidates.map((c) => c.order.orderId),
  ]);
  const stillUnresolvedFromExact = exactResult.unmatched.filter(
    (u) => !handedToFuzzyOrSplit.has(u.order.orderId)
  );

  const allMatches = [...exactResult.matches, ...fuzzyResult.matches, ...splitResult.matches];
  const allUnmatched = [...stillUnresolvedFromExact, ...fuzzyResult.unmatched, ...splitResult.unmatched];

  const results = [];

  for (const m of allMatches) {
    const availableFields = availableFieldsFor(m.order, m.settlement);
    const decision = decideAction({ confidence: m.confidence, amount: m.order.amount, availableFields });

    results.push({
      orderId: m.orderId,
      matchType: m.matchType,
      confidence: m.confidence,
      recommendedAction: decision.action,
      requiresHumanApproval: decision.requiresHumanApproval,
      missingFields: decision.missingFields,
      note: m.note || decision.reason,
    });
  }

  for (const u of allUnmatched) {
    const confidence = UNMATCHED_CONFIDENCE[u.reason] ?? 0.1;
    const availableFields = availableFieldsFor(u.order, u.settlement);
    const decision = decideAction({ confidence, amount: u.order.amount, availableFields });

    results.push({
      orderId: u.order.orderId,
      matchType: "none",
      confidence,
      recommendedAction: decision.action,
      requiresHumanApproval: decision.requiresHumanApproval,
      missingFields: decision.missingFields,
      note: `${u.reason}: ${decision.reason}`,
    });
  }

  return {
    results,
    warnings: exactResult.warnings,
    summary: summarize(results),
  };
}

function summarize(results) {
  const byAction = {};
  const byMatchType = {};
  for (const r of results) {
    byAction[r.recommendedAction] = (byAction[r.recommendedAction] || 0) + 1;
    byMatchType[r.matchType] = (byMatchType[r.matchType] || 0) + 1;
  }
  return { total: results.length, byAction, byMatchType };
}

module.exports = { runFullMatchingPipeline };
