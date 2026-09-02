const { explainException } = require("../src/services/agent/explainException");

describe("explainException", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GROQ_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GROQ_API_KEY = originalKey;
  });

  test("falls back to template when GROQ_API_KEY is not set - never breaks a batch", async () => {
    delete process.env.GROQ_API_KEY;

    const result = await explainException({
      transactions: [],
      nearestCandidateDiff: { possibleCause: "fee_mismatch" },
      confidence: 0.85,
      amount: 1000,
      availableFields: ["orderId", "amount", "date", "utr"],
    });

    expect(result.reason).toContain("Razorpay fee");
    expect(result.recommended_action).toBe("flag_for_review"); // 0.85 < 0.9 auto-resolve threshold
    expect(result.requires_human_approval).toBe(true);
  });

  test("uses the Groq response when the call succeeds", async () => {
    process.env.GROQ_API_KEY = "fake-key-for-test";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "The settlement was short by the exact Razorpay fee amount." } }],
      }),
    });

    const result = await explainException({
      transactions: [],
      nearestCandidateDiff: { possibleCause: "fee_mismatch", gap: 23.6 },
      confidence: 0.85,
      amount: 1000,
      availableFields: ["orderId", "amount", "date", "utr"],
    });

    expect(result.reason).toBe("The settlement was short by the exact Razorpay fee amount.");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    // The decision itself must still come from the policy, not the LLM -
    // this is the core architectural guarantee from Day 1/9.
    expect(result.recommended_action).toBe("flag_for_review");
    expect(result.confidence).toBe(0.85);
  });

  test("falls back to template when Groq returns a non-OK response", async () => {
    process.env.GROQ_API_KEY = "fake-key-for-test";
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });

    const result = await explainException({
      transactions: [],
      nearestCandidateDiff: { possibleCause: "duplicate" },
      confidence: 0.95,
      amount: 1000,
      availableFields: ["orderId", "amount", "date", "utr"],
    });

    expect(result.reason).toContain("matching amount and date");
    expect(result.recommended_action).toBe("auto_resolve"); // policy decision unaffected by LLM failure
  });

  test("falls back to template when Groq returns an empty response", async () => {
    process.env.GROQ_API_KEY = "fake-key-for-test";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    });

    const result = await explainException({
      transactions: [],
      nearestCandidateDiff: { possibleCause: "delayed_settlement" },
      confidence: 0.4,
      amount: 1000,
      availableFields: ["orderId", "amount", "date"],
    });

    expect(result.reason).toContain("date window");
  });

  test("falls back to template when the request times out", async () => {
    process.env.GROQ_API_KEY = "fake-key-for-test";
    global.fetch = jest.fn().mockImplementation((url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const result = await explainException({
      transactions: [],
      nearestCandidateDiff: { possibleCause: "unknown_discrepancy" },
      confidence: 0.3,
      amount: 1000,
      availableFields: ["orderId", "amount", "date"],
    });

    expect(result.reason).toContain("does not fit a known pattern");
  }, 10000);
});
