/**
 * Exact-match engine - Day 4 baseline.
 *
 * Strategy, in order:
 *   1. For each ledger order, find settlement record(s) with the same orderId.
 *      - Zero found -> unmatched (settlement hasn't happened / no settlement data).
 *      - More than one found -> ambiguous, NOT auto-matched here. This is
 *        exactly the split-settlement case, and deliberately left for the
 *        Day 5 split engine rather than guessed at here - a wrong guess on
 *        real money is worse than an honest "needs more logic."
 *   2. With exactly one settlement record: find bank record(s) by UTR.
 *      - Zero found -> unmatched (bank credit hasn't landed yet, or UTR missing
 *        from the settlement report - both real, both legitimate "not yet",
 *        not necessarily an error).
 *      - Multiple found with identical amount+date -> duplicate bank entry.
 *        Take one, record the rest as a duplicate warning. This is safe to
 *        resolve here (unlike split-settlement) because "same UTR, same
 *        amount, same date, twice" has only one honest explanation: a
 *        duplicate row, not two different real credits.
 *   3. Verify the math: order_amount - settlement.fee - settlement.tax should
 *      equal settlement.amount within a small epsilon (floating point safety
 *      margin, not a matching "tolerance" - true fuzzy tolerance is Day 5).
 *      If the settlement report's fee/tax fields don't explain the gap
 *      (e.g. they're zeroed out even though money was actually deducted),
 *      that's the fee_mismatch case - NOT matched here, left for Day 5's
 *      fuzzy engine which knows how to recognize a fee-sized gap.
 *
 * Everything this engine does NOT resolve is returned as `unmatched`, with a
 * `reason` explaining why - not a black box "no match found."
 */

const AMOUNT_EPSILON = 0.01; // paise-level floating point safety margin only

function runExactMatch({ ledger, settlement, bank }) {
  const matches = [];
  const unmatched = [];
  const warnings = [];

  for (const order of ledger) {
    const settlementCandidates = settlement.filter((s) => s.orderId === order.orderId);

    if (settlementCandidates.length === 0) {
      unmatched.push({ order, reason: "no_settlement_record_found" });
      continue;
    }

    if (settlementCandidates.length > 1) {
      unmatched.push({
        order,
        reason: "multiple_settlement_records_found",
        candidates: settlementCandidates,
      });
      continue;
    }

    const s = settlementCandidates[0];

    const expectedSettledAmount = round2(order.amount - s.fee - s.tax);
    const amountReconciles = Math.abs(expectedSettledAmount - s.amount) <= AMOUNT_EPSILON;

    if (!amountReconciles) {
      unmatched.push({
        order,
        settlement: s,
        reason: "amount_does_not_reconcile",
        expected: expectedSettledAmount,
        actual: s.amount,
      });
      continue;
    }

    if (!s.utr) {
      unmatched.push({ order, settlement: s, reason: "settlement_missing_utr" });
      continue;
    }

    const bankCandidates = bank.filter((b) => b.utr === s.utr);

    if (bankCandidates.length === 0) {
      unmatched.push({ order, settlement: s, reason: "no_bank_record_for_utr" });
      continue;
    }

    let bankRecord = bankCandidates[0];

    if (bankCandidates.length > 1) {
      const allIdentical = bankCandidates.every(
        (b) => b.amount === bankCandidates[0].amount && b.date === bankCandidates[0].date
      );
      if (allIdentical) {
        warnings.push({
          order,
          type: "duplicate_bank_entry",
          count: bankCandidates.length,
          utr: s.utr,
        });
        // safe to take one - see docstring above for why this differs from split-settlement
      } else {
        unmatched.push({
          order,
          settlement: s,
          reason: "multiple_conflicting_bank_records_for_utr",
          candidates: bankCandidates,
        });
        continue;
      }
    }

    if (Math.abs(bankRecord.amount - s.amount) > AMOUNT_EPSILON) {
      unmatched.push({
        order,
        settlement: s,
        bank: bankRecord,
        reason: "bank_amount_does_not_match_settlement",
      });
      continue;
    }

    matches.push({
      orderId: order.orderId,
      matchType: "exact",
      order,
      settlement: s,
      bank: bankRecord,
      confidence: 1.0,
    });
  }

  return { matches, unmatched, warnings };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { runExactMatch };
