const { decideAction } = require("../scoring/decisionPolicy");

/**
 * Tool: explainException
 * Purpose: narrate a transaction diff into a human-readable explanation.
 *
 * Decision flow: decideAction() (deterministic policy) runs FIRST and its
 * output - action, requiresHumanApproval, missingFields - is treated as fact.
 * The LLM (or its fallback) only writes the "reason" prose; it cannot change
 * the action, and any action field it returns is discarded, never trusted.
 * This preserves the Day 1 rule: confidence and requires_human_approval are
 * never taken from the LLM's output even if it echoes them.
 *
 * Input: { transactions[], nearestCandidateDiff, confidence, amount, availableFields }
 * Output: structured JSON matching the Day 1 AI output schema, plus `action`.
 * Allowed actions: read-only, text generation only. Never queries DB or calls Razorpay.
 *
 * STATUS: Day 2 skeleton - wires the fallback path so the system is demo-safe from
 * day one. Real Groq/OpenRouter call gets filled in on Day 9; when it lands, it
 * still only fills `reason`, per the decision flow above.
 */

async function explainException({ transactions, nearestCandidateDiff, confidence, amount, availableFields }) {
  // Deterministic step - always runs, LLM or not.
  const policyDecision = decideAction({ confidence, amount, availableFields });

  let reason;
  try {
    if (!process.env.LLM_API_KEY) {
      throw new Error("LLM_API_KEY not set");
    }

    // TODO (Day 9): real call to Groq/OpenRouter free-tier model here.
    // const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { ... });
    // Parse the response, validate it's a string, assign to `reason`.
    // Do NOT let the LLM response override policyDecision.action or .requiresHumanApproval.

    throw new Error("LLM call not yet implemented - using fallback");
  } catch (err) {
    reason = templateReason({ nearestCandidateDiff, policyDecision });
  }

  return {
    decision: policyDecision.action === "auto_resolve" ? "auto_resolve" : "flag_exception",
    confidence, // recomputed deterministically upstream, just echoed here
    reason,
    recommended_action: policyDecision.action,
    requires_human_approval: policyDecision.requiresHumanApproval,
    missing_fields: policyDecision.missingFields,
  };
}

// Deterministic, template-based reason text. Used whenever the LLM call fails,
// times out, or isn't configured - keeps the demo reliable regardless of API state.
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
