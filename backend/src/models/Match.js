const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  transactionIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
  ], // 2+ entries for split-settlement matches
  matchType: {
    type: String,
    enum: ["exact", "fuzzy", "split", "reference"],
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  // The policy's chosen next step - see services/scoring/decisionPolicy.js.
  // This is what makes the agent a decision-maker rather than a single-path
  // classifier: it branches between 4 outcomes, not just match/no-match.
  recommendedAction: {
    type: String,
    enum: ["auto_resolve", "flag_for_review", "request_more_data", "escalate_high_value"],
    required: true,
  },
  status: {
    type: String,
    enum: ["auto_resolved", "pending_review", "resolved", "rejected"],
    default: "pending_review",
  },
  missingFields: [{ type: String }], // populated when recommendedAction is request_more_data
  explanation: { type: String, default: null }, // LLM- or template-generated
  resolvedBy: {
    type: String,
    enum: ["system", "human", null],
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

matchSchema.index({ batchId: 1, status: 1 });

module.exports = mongoose.model("Match", matchSchema);
