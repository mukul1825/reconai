const { decideAction, THRESHOLDS } = require("../src/services/scoring/decisionPolicy");

describe("decisionPolicy.decideAction", () => {
  const allFields = ["utr", "orderId", "amount", "date"];

  test("high confidence, normal value -> auto_resolve", () => {
    const result = decideAction({ confidence: 0.95, amount: 1000, availableFields: allFields });
    expect(result.action).toBe("auto_resolve");
    expect(result.requiresHumanApproval).toBe(false);
  });

  test("high confidence, high value -> escalate_high_value (overrides auto_resolve)", () => {
    const result = decideAction({
      confidence: 0.95,
      amount: THRESHOLDS.HIGH_VALUE_AMOUNT + 1,
      availableFields: allFields,
    });
    expect(result.action).toBe("escalate_high_value");
    expect(result.requiresHumanApproval).toBe(true);
  });

  test("mid confidence, missing field -> request_more_data", () => {
    const result = decideAction({
      confidence: 0.6,
      amount: 1000,
      availableFields: ["orderId", "amount", "date"], // utr missing
    });
    expect(result.action).toBe("request_more_data");
    expect(result.missingFields).toContain("utr");
  });

  test("mid confidence, no missing fields -> flag_for_review (not request_more_data)", () => {
    const result = decideAction({ confidence: 0.6, amount: 1000, availableFields: allFields });
    expect(result.action).toBe("flag_for_review");
  });

  test("low confidence -> flag_for_review even if fields are missing", () => {
    const result = decideAction({
      confidence: 0.2,
      amount: 1000,
      availableFields: ["amount", "date"],
    });
    expect(result.action).toBe("flag_for_review");
  });
});
