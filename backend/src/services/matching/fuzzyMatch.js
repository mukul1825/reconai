/**
 * Fuzzy match engine - Day 5.
 *
 * Input: the `unmatched` list from runExactMatch, filtered to entries with
 * reason "amount_does_not_reconcile" (settlement exists, orderId matched,
 * but the reported fee/tax don't explain the settlement amount).
 *
 * The question this engine answers: "does the unexplained gap look like a
 * Razorpay fee, even though the settlement report's fee/tax fields say
 * otherwise?" This is deliberately narrow - it does NOT try to explain any
 * gap of any size. A gap that's fee-shaped (roughly 1-4% of the order
 * amount) is a plausible reporting bug. A gap of 40% is not a fee - it's
 * something else, and guessing would be irresponsible with real money.
 *
 * Still requires bank verification, same as the exact engine - a fee-shaped
 * gap alone is not proof, just plausibility. The bank record confirms the
 * money that actually moved matches the settlement figure.
 */

const { reconciliationConfidence, round2 } = require("../scoring/confidenceScoring");

const FEE_RATE = 0.02;
const GST_ON_FEE = 0.18;
const FUZZY_MAX_CONFIDENCE = 0.85; // ceiling - see confidenceScoring.js docstring
const AMOUNT_EPSILON = 0.01;

// How far the actual gap is allowed to stray from the estimated fee before
// we stop calling it "fee-shaped." Wide enough to catch rounding/rate
// variance, narrow enough not to rubber-stamp arbitrary discrepancies.
const GAP_TOLERANCE_RATIO = 0.5; // actual gap must be within 50% of estimated fee

function runFuzzyMatch(exactUnmatched, bank) {
  const candidates = exactUnmatched.filter((u) => u.reason === "amount_does_not_reconcile");

  const matches = [];
  const unmatched = [];

  for (const candidate of candidates) {
    const { order, settlement: s } = candidate;
    const gap = round2(order.amount - s.amount);

    const estimatedFee = round2(order.amount * FEE_RATE);
    const estimatedTax = round2(estimatedFee * GST_ON_FEE);
    const estimatedTotal = round2(estimatedFee + estimatedTax);

    const gapIsPositive = gap > 0;
    const gapIsFeeShaped =
      gapIsPositive && Math.abs(gap - estimatedTotal) <= estimatedTotal * GAP_TOLERANCE_RATIO;

    if (!gapIsFeeShaped) {
      unmatched.push({ ...candidate, reason: "gap_not_fee_shaped", gap, estimatedTotal });
      continue;
    }

    if (!s.utr) {
      unmatched.push({ ...candidate, reason: "settlement_missing_utr" });
      continue;
    }

    const bankCandidates = bank.filter((b) => b.utr === s.utr);

    if (bankCandidates.length === 0) {
      unmatched.push({ ...candidate, reason: "no_bank_record_for_utr" });
      continue;
    }

    const bankRecord = bankCandidates[0];

    if (Math.abs(bankRecord.amount - s.amount) > AMOUNT_EPSILON) {
      unmatched.push({ ...candidate, reason: "bank_amount_does_not_match_settlement" });
      continue;
    }

    const confidence = reconciliationConfidence(estimatedTotal, gap, FUZZY_MAX_CONFIDENCE);

    matches.push({
      orderId: order.orderId,
      matchType: "fuzzy",
      order,
      settlement: s,
      bank: bankRecord,
      confidence,
      gap, // real computed gap amount - was only baked into `note` text before, never
           // available as data for anything downstream (e.g. the LLM explainer) to use
      note: `Settlement was ₹${gap} lower than order amount (~₹${estimatedTotal} expected fee+tax), but the settlement report's fee/tax fields were not populated.`,
    });
  }

  return { matches, unmatched };
}

module.exports = { runFuzzyMatch, FEE_RATE, GST_ON_FEE };
