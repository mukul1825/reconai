/**
 * Orchestrates the matching pipeline for a batch: exact -> fuzzy -> split-settlement.
 *
 * STATUS: placeholder for Day 2 (models + skeleton + auth only).
 * Real matching logic (exact/fuzzy/split engines + confidence scoring) is Day 4-5 work
 * per the 15-day plan - do not build it out here yet, just keep the pipeline callable
 * end-to-end so routes and the dashboard have something real to hit.
 *
 * @param {import("mongoose").Types.ObjectId} batchId
 */
async function runMatchingPipeline(batchId) {
  const Batch = require("../../models/Batch");
  const AuditLog = require("../../models/AuditLog");

  // TODO (Day 4): exact match engine
  // TODO (Day 5): fuzzy match + split-settlement (many-to-one) engine + confidence scoring
  // TODO (Day 6): wire Razorpay Test-Mode-shaped settlement schema into ingest
  // TODO (Day 9): LLM explainer call for unresolved exceptions, with template fallback

  await Batch.findByIdAndUpdate(batchId, {
    status: "complete",
    matchRate: null, // real value computed once the matching engine exists
  });

  await AuditLog.create({
    batchId,
    actor: "system",
    event: "batch_uploaded",
    payload: { note: "Matching pipeline not yet implemented - Day 2 skeleton only." },
  });
}

module.exports = { runMatchingPipeline };
