const express = require("express");
const { z } = require("zod");
const Match = require("../models/Match");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const { ApiError } = require("../utils/apiError");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const resolveSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

// POST /api/v1/matches/:id/resolve
// The human approval gate: nothing here writes anywhere financial, it only updates
// ReconAI's own records. This is the one endpoint that turns a "pending_review"
// exception into a final state, and it's always attributable to a human actor.
router.post(
  "/:id/resolve",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("MISSING_REQUIRED_FIELD", "decision must be 'approve' or 'reject'.", 400);
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      throw new ApiError("MATCH_NOT_FOUND", "Match could not be found.", 404);
    }
    if (match.status === "resolved" || match.status === "rejected") {
      throw new ApiError("MATCH_ALREADY_RESOLVED", "This match has already been resolved.", 409);
    }

    const { decision, note } = parsed.data;
    match.status = decision === "approve" ? "resolved" : "rejected";
    match.resolvedBy = "human";
    await match.save();

    await Transaction.updateMany(
      { _id: { $in: match.transactionIds } },
      { matchStatus: match.status }
    );

    await AuditLog.create({
      batchId: match.batchId,
      matchId: match._id,
      actor: `user:${req.userId}`,
      event: decision === "approve" ? "human_approved" : "human_rejected",
      confidence: match.confidence,
      payload: note ? { note } : null,
    });

    res.json({ matchId: match._id, status: match.status });
  })
);

module.exports = router;
