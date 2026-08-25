const { runFuzzyMatch } = require("../src/services/matching/fuzzyMatch");

describe("runFuzzyMatch", () => {
  test("fee-shaped gap with valid bank record -> resolves with confidence below 1.0", () => {
    const exactUnmatched = [
      {
        order: { orderId: "o1", amount: 1000, date: "2026-08-01" },
        settlement: { orderId: "o1", amount: 976, fee: 0, tax: 0, utr: "UTR1", date: "2026-08-02" },
        reason: "amount_does_not_reconcile",
        expected: 1000,
        actual: 976,
      },
    ];
    const bank = [{ amount: 976, utr: "UTR1", date: "2026-08-02" }];

    const result = runFuzzyMatch(exactUnmatched, bank);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchType).toBe("fuzzy");
    expect(result.matches[0].confidence).toBeLessThan(1.0);
    expect(result.matches[0].confidence).toBeGreaterThan(0);
  });

  test("gap way too large to be a fee -> not resolved, real discrepancy preserved", () => {
    const exactUnmatched = [
      {
        order: { orderId: "o2", amount: 1000, date: "2026-08-01" },
        settlement: { orderId: "o2", amount: 400, fee: 0, tax: 0, utr: "UTR2", date: "2026-08-02" }, // 60% gap, not a fee
        reason: "amount_does_not_reconcile",
      },
    ];
    const bank = [{ amount: 400, utr: "UTR2", date: "2026-08-02" }];

    const result = runFuzzyMatch(exactUnmatched, bank);

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("gap_not_fee_shaped");
  });

  test("fee-shaped gap but no bank record to verify against -> not resolved", () => {
    const exactUnmatched = [
      {
        order: { orderId: "o3", amount: 1000, date: "2026-08-01" },
        settlement: { orderId: "o3", amount: 976, fee: 0, tax: 0, utr: "UTR3", date: "2026-08-02" },
        reason: "amount_does_not_reconcile",
      },
    ];
    const bank = []; // nothing to verify against

    const result = runFuzzyMatch(exactUnmatched, bank);

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("no_bank_record_for_utr");
  });
});
