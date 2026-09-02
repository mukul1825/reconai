const express = require("express");
const multer = require("multer");
const Batch = require("../models/Batch");
const Transaction = require("../models/Transaction");
const Match = require("../models/Match");
const AuditLog = require("../models/AuditLog");
const { ApiError } = require("../utils/apiError");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/auth");
const { runMatchingPipeline } = require("../services/matching/runMatchingPipeline");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/v1/batches
// Uploads bank/settlement/ledger CSVs, creates a batch, runs the full
// matching pipeline (exact -> fuzzy -> split -> decision policy), and
// persists Transaction + Match + AuditLog records. This is synchronous for
// now (fine at hackathon-demo batch sizes of a few hundred rows); if batch
// sizes grow, this is the point where you'd move to a background job queue
// rather than blocking the HTTP response - noted here rather than built,
// since it's not needed at this scale and would be scope creep per the
// Day 1 feature freeze.
router.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "bank", maxCount: 1 },
    { name: "settlement", maxCount: 1 },
    { name: "ledger", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const { bank, settlement, ledger } = req.files || {};
    if (!bank || !settlement || !ledger) {
      throw new ApiError(
        "MISSING_REQUIRED_FIELD",
        "All three files (bank, settlement, ledger) are required.",
        400
      );
    }

    const batch = await Batch.create({ userId: req.userId, status: "processing" });

    try {
      const { matchRate, summary } = await runMatchingPipeline(batch._id, {
        ledgerCsv: ledger[0].buffer.toString("utf-8"),
        settlementCsv: settlement[0].buffer.toString("utf-8"),
        bankCsv: bank[0].buffer.toString("utf-8"),
      });

      res.status(201).json({ batchId: batch._id, status: "complete", matchRate, summary });
    } catch (err) {
      await Batch.findByIdAndUpdate(batch._id, { status: "failed" });
      throw new ApiError(
        "INVALID_CSV_FORMAT",
        `Could not process the uploaded files: ${err.message}`,
        400
      );
    }
  })
);

// GET /api/v1/batches?limit=10&cursor=<batchId>
// Lists the authenticated user's batches, newest first, for the dashboard's
// "recent batches" section. Cursor-based (on _id) rather than skip/limit -
// skip() re-scans and discards every prior page server-side, which gets
// slower as batch history grows; a cursor on an indexed field doesn't. Not
// load-bearing at hackathon-demo data volumes, but it's the correct pattern
// and costs nothing extra to implement correctly the first time.
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const cursor = req.query.cursor;

    const query = { userId: req.userId };
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // Fetch one extra row to know whether another page exists, without a
    // separate count query.
    const batches = await Batch.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select("status matchRate uploadedAt");

    const hasMore = batches.length > limit;
    const page = hasMore ? batches.slice(0, limit) : batches;

    if (page.length === 0) {
      return res.json({ batches: [], nextCursor: null });
    }

    // One aggregation across all batches in this page, grouped by
    // (batchId, status) - avoids N separate count queries per row.
    const batchIds = page.map((b) => b._id);
    const statusAgg = await Match.aggregate([
      { $match: { batchId: { $in: batchIds } } },
      { $group: { _id: { batchId: "$batchId", status: "$status" }, count: { $sum: 1 } } },
    ]);

    const countsByBatch = new Map();
    for (const row of statusAgg) {
      const key = row._id.batchId.toString();
      if (!countsByBatch.has(key)) {
        countsByBatch.set(key, { total: 0, autoResolved: 0, pendingReview: 0 });
      }
      const entry = countsByBatch.get(key);
      entry.total += row.count;
      if (row._id.status === "auto_resolved") entry.autoResolved += row.count;
      if (row._id.status === "pending_review") entry.pendingReview += row.count;
    }

    const result = page.map((b) => {
      const counts = countsByBatch.get(b._id.toString()) || { total: 0, autoResolved: 0, pendingReview: 0 };
      return {
        batchId: b._id,
        status: b.status,
        matchRate: b.matchRate,
        uploadedAt: b.uploadedAt,
        totalOrders: counts.total,
        autoResolved: counts.autoResolved,
        pendingReview: counts.pendingReview,
      };
    });

    res.json({
      batches: result,
      nextCursor: hasMore ? page[page.length - 1]._id : null,
    });
  })
);

// GET /api/v1/batches/:id
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const batch = await Batch.findOne({ _id: req.params.id, userId: req.userId });
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "Batch could not be found.", 404);
    }

    const [autoResolved, pendingReview, resolved, rejected] = await Promise.all([
      Match.countDocuments({ batchId: batch._id, status: "auto_resolved" }),
      Match.countDocuments({ batchId: batch._id, status: "pending_review" }),
      Match.countDocuments({ batchId: batch._id, status: "resolved" }),
      Match.countDocuments({ batchId: batch._id, status: "rejected" }),
    ]);

    // Match-type breakdown (exact/fuzzy/split/none) - powers the dashboard's
    // "resolution by match type" bar. Aggregated fresh rather than trusting
    // a cached count, since matches can move between resolved/rejected after
    // human review without changing their original matchType.
    const matchTypeAgg = await Match.aggregate([
      { $match: { batchId: batch._id } },
      { $group: { _id: "$matchType", count: { $sum: 1 } } },
    ]);
    const byMatchType = Object.fromEntries(matchTypeAgg.map((m) => [m._id, m.count]));

    res.json({
      batchId: batch._id,
      status: batch.status,
      matchRate: batch.matchRate,
      totals: { autoResolved, pendingReview, resolved, rejected },
      byMatchType,
    });
  })
);

// GET /api/v1/batches/:id/exceptions
router.get(
  "/:id/exceptions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const batch = await Batch.findOne({ _id: req.params.id, userId: req.userId });
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "Batch could not be found.", 404);
    }

    const exceptions = await Match.find({
      batchId: batch._id,
      status: "pending_review",
    }).select("transactionIds confidence explanation matchType recommendedAction missingFields");

    res.json(exceptions);
  })
);

// GET /api/v1/batches/:id/audit
router.get(
  "/:id/audit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const batch = await Batch.findOne({ _id: req.params.id, userId: req.userId });
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "Batch could not be found.", 404);
    }

    const logs = await AuditLog.find({ batchId: batch._id })
      .sort({ timestamp: -1 })
      .select("event actor confidence timestamp");

    res.json(logs);
  })
);

module.exports = router;
