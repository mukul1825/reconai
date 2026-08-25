const { runExactMatch } = require("../src/services/matching/exactMatch");

// Hand-crafted, minimal fixtures - one case per category, values chosen to be
// easy to verify by hand. This is deliberately separate from the Python
// generator's output: unit tests should be self-contained and not depend on
// regenerating external data to run in CI.

describe("runExactMatch", () => {
  test("clean exact match resolves with confidence 1.0", () => {
    const ledger = [{ orderId: "o1", amount: 1000, date: "2026-08-01" }];
    const settlement = [
      { orderId: "o1", amount: 970, fee: 20, tax: 10, utr: "UTR1", date: "2026-08-02" },
    ];
    const bank = [{ amount: 970, utr: "UTR1", date: "2026-08-02" }];

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchType).toBe("exact");
    expect(result.matches[0].confidence).toBe(1.0);
    expect(result.unmatched).toHaveLength(0);
  });

  test("fee/tax not netted in settlement report -> unmatched, not silently accepted", () => {
    const ledger = [{ orderId: "o2", amount: 1000, date: "2026-08-01" }];
    // fee/tax zeroed out even though settled_amount reflects a real deduction
    const settlement = [
      { orderId: "o2", amount: 970, fee: 0, tax: 0, utr: "UTR2", date: "2026-08-02" },
    ];
    const bank = [{ amount: 970, utr: "UTR2", date: "2026-08-02" }];

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("amount_does_not_reconcile");
  });

  test("split settlement (2 settlement records for 1 order) -> unmatched, flagged for split logic", () => {
    const ledger = [{ orderId: "o3", amount: 1000, date: "2026-08-01" }];
    const settlement = [
      { orderId: "o3", amount: 500, fee: 10, tax: 2, utr: "UTR3a", date: "2026-08-02" },
      { orderId: "o3", amount: 488, fee: 10, tax: 2, utr: "UTR3b", date: "2026-08-03" },
    ];
    const bank = [
      { amount: 500, utr: "UTR3a", date: "2026-08-02" },
      { amount: 488, utr: "UTR3b", date: "2026-08-03" },
    ];

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("multiple_settlement_records_found");
  });

  test("settlement exists but bank credit hasn't landed yet -> unmatched, not an error", () => {
    const ledger = [{ orderId: "o4", amount: 1000, date: "2026-08-01" }];
    const settlement = [
      { orderId: "o4", amount: 970, fee: 20, tax: 10, utr: "UTR4", date: "2026-08-02" },
    ];
    const bank = []; // deliberately empty - credit not yet in this batch

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("no_bank_record_for_utr");
  });

  test("settlement missing UTR entirely -> unmatched with the correct reason", () => {
    const ledger = [{ orderId: "o5", amount: 1000, date: "2026-08-01" }];
    const settlement = [
      { orderId: "o5", amount: 970, fee: 20, tax: 10, utr: null, date: "2026-08-02" },
    ];
    const bank = [{ amount: 970, utr: "UTR5", date: "2026-08-02" }];

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("settlement_missing_utr");
  });

  test("duplicate identical bank entry -> still resolves as a match, plus a warning", () => {
    const ledger = [{ orderId: "o6", amount: 1000, date: "2026-08-01" }];
    const settlement = [
      { orderId: "o6", amount: 970, fee: 20, tax: 10, utr: "UTR6", date: "2026-08-02" },
    ];
    const bank = [
      { amount: 970, utr: "UTR6", date: "2026-08-02" },
      { amount: 970, utr: "UTR6", date: "2026-08-02" }, // exact duplicate row
    ];

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe("duplicate_bank_entry");
  });

  test("two DIFFERENT bank records share a UTR (conflicting, not duplicate) -> unmatched, not guessed", () => {
    const ledger = [{ orderId: "o7", amount: 1000, date: "2026-08-01" }];
    const settlement = [
      { orderId: "o7", amount: 970, fee: 20, tax: 10, utr: "UTR7", date: "2026-08-02" },
    ];
    const bank = [
      { amount: 970, utr: "UTR7", date: "2026-08-02" },
      { amount: 500, utr: "UTR7", date: "2026-08-03" }, // different amount - a real conflict, not a dup
    ];

    const result = runExactMatch({ ledger, settlement, bank });

    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0].reason).toBe("multiple_conflicting_bank_records_for_utr");
  });
});
