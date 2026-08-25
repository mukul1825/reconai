/**
 * Split-settlement engine - Day 5.
 *
 * Input: the `unmatched` list from runExactMatch, filtered to entries with
 * reason "multiple_settlement_records_found" - orders where more than one
 * settlement record shares the same orderId. The exact-match engine
 * deliberately refused to guess here (see exactMatch.js docstring); this is
 * where that ambiguity actually gets resolved.
 *
 * The check: do the settlement amounts SUM to what's expected after summed
 * fee/tax deductions? If yes, and every individual settlement leg has a
 * verifiable bank record, it's a genuine split settlement, not a data error.
 * If the sum doesn't reconcile, or any individual leg can't be verified
 * against the bank statement, this does NOT resolve - a partially-verified
 * split is exactly the kind of case that should reach a human, not get
 * silently approved.
 */

const { reconciliationConfidence, round2 } = require("../scoring/confidenceScoring");

const SPLIT_MAX_CONFIDENCE = 0.95; // slightly below exact's 1.0 - see confidenceScoring.js
const SUM_EPSILON = 0.05; // wider than single-record epsilon - rounding compounds across legs
const AMOUNT_EPSILON = 0.01;

function runSplitMatch(exactUnmatched, bank) {
  const candidates = exactUnmatched.filter((u) => u.reason === "multiple_settlement_records_found");

  const matches = [];
  const unmatched = [];

  for (const candidate of candidates) {
    const { order, candidates: settlementLegs } = candidate;

    const sumSettled = round2(settlementLegs.reduce((acc, s) => acc + s.amount, 0));
    const sumFee = round2(settlementLegs.reduce((acc, s) => acc + s.fee, 0));
    const sumTax = round2(settlementLegs.reduce((acc, s) => acc + s.tax, 0));
    const expectedTotal = round2(order.amount - sumFee - sumTax);

    const sumReconciles = Math.abs(expectedTotal - sumSettled) <= SUM_EPSILON;

    if (!sumReconciles) {
      unmatched.push({
        order,
        reason: "split_amounts_do_not_reconcile",
        expectedTotal,
        sumSettled,
        legs: settlementLegs,
      });
      continue;
    }

    // Verify EVERY leg against the bank statement - a split match is only
    // as trustworthy as its weakest leg.
    const verifiedLegs = [];
    let allLegsVerified = true;

    for (const leg of settlementLegs) {
      if (!leg.utr) {
        allLegsVerified = false;
        break;
      }
      const bankCandidates = bank.filter((b) => b.utr === leg.utr);
      const bankRecord = bankCandidates[0];
      if (!bankRecord || Math.abs(bankRecord.amount - leg.amount) > AMOUNT_EPSILON) {
        allLegsVerified = false;
        break;
      }
      verifiedLegs.push({ settlement: leg, bank: bankRecord });
    }

    if (!allLegsVerified) {
      unmatched.push({
        order,
        reason: "split_leg_not_verifiable_against_bank",
        legs: settlementLegs,
      });
      continue;
    }

    const confidence = reconciliationConfidence(expectedTotal, sumSettled, SPLIT_MAX_CONFIDENCE);

    matches.push({
      orderId: order.orderId,
      matchType: "split",
      order,
      legs: verifiedLegs,
      confidence,
      note: `Order settled across ${verifiedLegs.length} separate records totaling ₹${sumSettled}, reconciling within ₹${SUM_EPSILON} of the expected ₹${expectedTotal} after fees.`,
    });
  }

  return { matches, unmatched };
}

module.exports = { runSplitMatch };
