const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Match",
    default: null, // null for batch-level events (e.g. upload)
  },
  actor: {
    type: String, // "system" or "user:<id>"
    required: true,
  },
  event: {
    type: String, // e.g. "batch_uploaded", "auto_resolved", "human_approved", "human_rejected"
    required: true,
  },
  confidence: { type: Number, default: null }, // snapshot at time of decision
  payload: { type: mongoose.Schema.Types.Mixed, default: null }, // small structured detail only, no raw secrets
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ batchId: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
