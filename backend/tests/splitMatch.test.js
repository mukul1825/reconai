const { runSplitMatch } = require("../src/services/matching/splitMatch");

describe("runSplitMatch", () => {
  test("two legs summing correctly, both bank-verified -> resolves with high confidence", () => {
    // order.amount(1000) - sumFee(20) - sumTax(3.6) = 976.4 = leg1(500) + leg2(476.4)
    const exactUnmatched = [
      {
        order: { orderId: "o1", amount: 1000, date: "2026-08-01" },
        reason: "multiple_settlement_records_found",
        candidates: [
          { orderId: "o1", amount: 500, fee: 10, tax: 1.8, utr: "UTR1a", date: "2026-08-02" },
          { orderId: "o1", amount: 476.4, fee: 10, tax: 1.8, utr: "UTR1b", date: "2026-08-03" },
        ],
      },
    ];
    const bank = [
      { amount: 500, utr: "UTR1a", date: "2026-08-02" },
      { amount: 476.4, utr: "UTR1b", date: "2026-08-03" },
    ];

    const result = runSplitMatch(exactUnmatched, bank);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchType).toBe("split");
    expect(result.matches[0].confidence).toBeGreaterThan(0.8);
    expect(result.matches[0].confidence).toBeLessThan(1.0);
  });

  test("legs sum to the wrong total -> not resolved, not guessed", () => {
    const exactUnmatched = [
      {
        order: { orderId: "o2", amount: 1000, date: "2026-08-01" },
        reason: "multiple_settlement_records_found",
        candidates: [
          { orderId: "o2", amount: 300, fee: 10, tax: 2, utr: "UTR2a", date: "2026-08-02" },
          { orderId: "o2", amount: 200, fee: 10, tax: 2, utr: "UTR2b", date: "2026-08-03" }, // sums way short of 1000
        ],
      },
    ];
    const bank = [
      { amount: 300, utr: "UTR2a", date: "2026-08-02" },
      { amount: 200, utr: "UTR2b", date: "2026-08-03" },
    ];

    const result = runSplitMatch(exactUnmatched, bank);

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("split_amounts_do_not_reconcile");
  });

  test("sum reconciles but one leg has no bank record -> not resolved (weakest leg rule)", () => {
    const exactUnmatched = [
      {
        order: { orderId: "o3", amount: 1000, date: "2026-08-01" },
        reason: "multiple_settlement_records_found",
        candidates: [
          { orderId: "o3", amount: 500, fee: 10, tax: 1.8, utr: "UTR3a", date: "2026-08-02" },
          { orderId: "o3", amount: 476.4, fee: 10, tax: 1.8, utr: "UTR3b", date: "2026-08-03" },
        ],
      },
    ];
    const bank = [
      { amount: 500, utr: "UTR3a", date: "2026-08-02" },
      // UTR3b's bank record is missing entirely
    ];

    const result = runSplitMatch(exactUnmatched, bank);

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("split_leg_not_verifiable_against_bank");
  });
});
