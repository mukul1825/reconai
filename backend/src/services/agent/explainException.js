const { decideAction } = require("../scoring/decisionPolicy");

/**
 * Tool: explainException
 * Purpose: narrate a transaction diff into a human-readable explanation.
 *
 * Decision flow: decideAction() (deterministic policy) runs FIRST and its
 * output - action, requiresHumanApproval, missingFields - is treated as
 * fact. The LLM (or its fallback) only writes the "reason" prose; it
 * cannot change the action, and nothing it returns is trusted for the
 * decision fields even if it echoes them back. This preserves the Day 1
 * rule: confidence and requires_human_approval are never taken from the
 * LLM's output.
 *
 * Input: { transactions[], nearestCandidateDiff, confidence, amount, availableFields }
 * Output: structured JSON matching the Day 1 AI output schema, plus `action`.
 * Allowed actions: read-only, text generation only. Never queries DB or calls Razorpay.
 *
 * STATUS (Day 9): real call to Groq's OpenAI-compatible endpoint, with a
 * hard timeout and the same template fallback from Day 5/6 on any failure -
 * the LLM being flaky, rate-limited, or unconfigured should never break a
 * batch run.
 *
 * MODEL NOTE: openai/gpt-oss-20b is a reasoning model - by default it
 * spends hidden "reasoning" tokens before writing its visible answer, and
 * those count against max_tokens. Found this the hard way: at max_tokens
 * 200 with default (medium) reasoning effort, calls were intermittently
 * returning empty or mid-sentence-truncated answers because reasoning ate
 * the whole budget. Fixed with reasoning_effort: "low" (this task needs no
 * real reasoning) plus a larger max_tokens (300) as headroom. If this
 * still misbehaves under real load, the more robust fix is switching to a
 * plain non-reasoning instruct model - noted as a candidate follow-up, not
 * done now given the deadline.
 */

const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You explain payment reconciliation discrepancies to a finance operations analyst.
You are given structured facts about ONE discrepancy: never invent numbers, order IDs, or causes not present in the facts.
If a fact is null or not provided, simply don't mention it - never comment on data being missing, unknown, or unavailable; explain only what you do know.
Respond with exactly one or two short plain sentences (under 40 words total). No JSON, no markdown, no preamble like "Here is the explanation:".`;

async function explainException({ transactions, nearestCandidateDiff, confidence, amount, availableFields }) {
  const policyDecision = decideAction({ confidence, amount, availableFields });

  let reason;
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not set");
    }
    reason = await callGroq({ nearestCandidateDiff, confidence, amount, policyDecision });
  } catch (err) {
  console.error("[explainException] Falling back to template. Reason:", err.message);
  reason = templateReason({ nearestCandidateDiff, policyDecision });
}

  return {
    decision: policyDecision.action === "auto_resolve" ? "auto_resolve" : "flag_exception",
    confidence,
    reason,
    recommended_action: policyDecision.action,
    requires_human_approval: policyDecision.requiresHumanApproval,
    missing_fields: policyDecision.missingFields,
  };
}

async function callGroq({ nearestCandidateDiff, confidence, amount, policyDecision }) {
  const facts = {
    order_amount: amount,
    confidence_score: confidence,
    likely_cause: nearestCandidateDiff?.possibleCause || "unknown",
    gap_amount: nearestCandidateDiff?.gap ?? null,
    decision_made: policyDecision.action,
    missing_fields: policyDecision.missingFields,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 300, // openai/gpt-oss-20b is a reasoning model - reasoning tokens count against
                          // this budget BEFORE the visible answer, so this needs real headroom above
                          // what a plain instruct model would need for the same short answer
        reasoning_effort: "low", // this task (1-2 sentence explanation from already-computed facts)
                                  // doesn't need real reasoning - "low" cuts hidden reasoning-token
                                  // consumption so more of max_tokens goes to the actual answer
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nExplain this discrepancy.` },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Groq API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text || text.length === 0 || text.length > 900) {
  throw new Error("Groq response was empty or unexpectedly long");
}

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function templateReason({ nearestCandidateDiff, policyDecision }) {
  const cause = nearestCandidateDiff?.possibleCause || "unknown_discrepancy";

  const causeTemplates = {
    fee_mismatch: "Settlement amount differs from the order amount by roughly the expected Razorpay fee.",
    delayed_settlement: "No matching settlement record found within the expected date window.",
    duplicate: "Multiple records with matching amount and date found.",
    unknown_discrepancy: "Amount or date mismatch detected that does not fit a known pattern.",
  };

  const actionSuffix = {
    auto_resolve: "Confidence is high enough to resolve automatically.",
    escalate_high_value: "Confidence is high, but the amount requires human sign-off due to its value.",
    request_more_data: `Resolving this needs: ${policyDecision.missingFields.join(", ")}.`,
    flag_for_review: "Needs manual review before it can be resolved.",
  };

  return `${causeTemplates[cause] || causeTemplates.unknown_discrepancy} ${actionSuffix[policyDecision.action]}`;
}

module.exports = { explainException };
