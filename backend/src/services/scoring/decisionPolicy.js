/**
 * Decision policy - the agent's PLAN/VERIFY step.
 *
 * This is what separates ReconAI's agent from "classifier + LLM caption":
 * given a candidate match, it picks ONE of four next actions using a small,
 * fully deterministic, auditable policy - not an LLM call. The LLM (see
 * services/agent/explainException.js) only narrates the decision this
 * function already made; it never makes it.
 *
 * Actions:
 *   auto_resolve       - confidence clears the bar, value is below the
 *                         escalation threshold -> resolve without a human.
 *   escalate_high_value - confidence clears the bar, but the ₹ value is high
 *                         enough that a human should sign off regardless.
 *   request_more_data  - confidence is mid-range AND a specific field needed
 *                         to decide is missing (e.g. no UTR to check against) -
 *                         asking for that field is more useful than a vague
 *                         "review this" flag.
 *   flag_for_review    - confidence is low, or nothing else applies -
 *                         the safe default.
 *
 * Thresholds are intentionally simple and named constants (not tuned on data
 * yet) - documented in the README as an explicit, defensible design choice
 * for the buildathon submission, not hidden magic numbers.
 */

const THRESHOLDS = {
  AUTO_RESOLVE_CONFIDENCE: 0.9,
  REVIEW_CONFIDENCE_FLOOR: 0.5, // below this: always flag, never ask for more data
  HIGH_VALUE_AMOUNT: 50000, // ₹ - above this, always require a human even if confident
};

// Fields the policy considers essential to a confident decision. If a match's
// underlying transactions are missing any of these, and confidence is in the
// mid-range, the agent asks for the specific field rather than dumping it
// into a generic review queue.
const DECISION_CRITICAL_FIELDS = ["utr", "orderId", "amount", "date"];

/**
 * @param {Object} context
 * @param {number} context.confidence - deterministic score from the scoring engine (Day 5), 0-1
 * @param {number} context.amount - transaction amount in ₹
 * @param {string[]} context.availableFields - fields actually present on the candidate transactions
 * @returns {{ action: string, requiresHumanApproval: boolean, missingFields: string[], reason: string }}
 */
function decideAction({ confidence, amount, availableFields = [] }) {
  const missingFields = DECISION_CRITICAL_FIELDS.filter((f) => !availableFields.includes(f));

  // High value always overrides straight auto-resolve, regardless of confidence.
  if (confidence >= THRESHOLDS.AUTO_RESOLVE_CONFIDENCE && amount >= THRESHOLDS.HIGH_VALUE_AMOUNT) {
    return {
      action: "escalate_high_value",
      requiresHumanApproval: true,
      missingFields: [],
      reason: `High confidence (${confidence.toFixed(2)}) but amount ₹${amount} exceeds the ₹${THRESHOLDS.HIGH_VALUE_AMOUNT} auto-resolve ceiling.`,
    };
  }

  if (confidence >= THRESHOLDS.AUTO_RESOLVE_CONFIDENCE) {
    return {
      action: "auto_resolve",
      requiresHumanApproval: false,
      missingFields: [],
      reason: `Confidence ${confidence.toFixed(2)} clears the auto-resolve threshold and amount is within limits.`,
    };
  }

  if (confidence >= THRESHOLDS.REVIEW_CONFIDENCE_FLOOR && missingFields.length > 0) {
    return {
      action: "request_more_data",
      requiresHumanApproval: true,
      missingFields,
      reason: `Confidence ${confidence.toFixed(2)} is inconclusive because ${missingFields.join(", ")} ${missingFields.length > 1 ? "are" : "is"} missing - resolving these would likely allow a decision.`,
    };
  }

  return {
    action: "flag_for_review",
    requiresHumanApproval: true,
    missingFields,
    reason: `Confidence ${confidence.toFixed(2)} is below the review floor - defaulting to human review.`,
  };
}

module.exports = { decideAction, THRESHOLDS, DECISION_CRITICAL_FIELDS };
