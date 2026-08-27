/**
 * Orchestrates the matching pipeline for a batch and persists the result.
 *
 * This is the bridge between the pure, DB-agnostic matching functions
 * (exactMatch/fuzzyMatch/splitMatch/matchAll - all take plain arrays in,
 * return plain objects out, no Mongoose involved) and actual persistence.
 * That boundary is deliberate, from Day 1: the matching logic never touches
 * the database directly, which is what let Day 4/5 be built and unit-tested
 * without ever needing a live Mongo connection.
 *
 * STATUS (Day 6): real end-to-end - parses the uploaded CSVs, saves
 * Transaction docs, runs the full matching pipeline, saves Match docs, and
 * writes an AuditLog entry per resolution. LLM explanation text for
 * exceptions is still the Day 5 template fallback - the real Groq call is
 * Day 9 work, wired in explainException.js.
 *
 * @param {import("mongoose").Types.ObjectId} batchId
 * @param {{ ledgerCsv: string, settlementCsv: string, bankCsv: string }} rawCsv
 */
async function runMatchingPipeline(batchId, rawCsv) {
  const Batch = require("../../models/Batch");
  const Transaction = require("../../models/Transaction");
  const Match = require("../../models/Match");
  const AuditLog = require("../../models/AuditLog");
  const { parseLedgerCsv, parseSettlementCsv, parseBankCsv } = require("./parseCsv");
  const { runFullMatchingPipeline } = require("./matchAll");
  const { explainException } = require("../agent/explainException");

  const ledger = parseLedgerCsv(rawCsv.ledgerCsv);
  const settlement = parseSettlementCsv(rawCsv.settlementCsv);
  const bank = parseBankCsv(rawCsv.bankCsv);

  // Persist raw transactions first, tagged with batchId, so the audit trail
  // and dashboard have something to point to regardless of match outcome.
  const savedLedger = await Transaction.insertMany(
    ledger.map((t) => ({ ...t, batchId }))
  );
  await Transaction.insertMany(settlement.map((t) => ({ ...t, batchId })));
  await Transaction.insertMany(bank.map((t) => ({ ...t, batchId })));

  const ledgerTxByOrderId = new Map(savedLedger.map((t) => [t.orderId, t]));

  const { results, summary } = runFullMatchingPipeline({ ledger, settlement, bank });

  let autoResolvedCount = 0;

  for (const result of results) {
    const ledgerTx = ledgerTxByOrderId.get(result.orderId);
    if (!ledgerTx) continue; // defensive - should never happen, every result maps back to a ledger order

    const status = result.recommendedAction === "auto_resolve" ? "auto_resolved" : "pending_review";
    if (status === "auto_resolved") autoResolvedCount += 1;

    // Exceptions get an explanation (LLM call with template fallback - see
    // explainException.js). Auto-resolved matches don't need one - there's
    // nothing for a human to be walked through.
    let explanation = null;
    if (status === "pending_review") {
      const explainerResult = await explainException({
        transactions: [ledgerTx],
        nearestCandidateDiff: { possibleCause: inferCause(result) },
        confidence: result.confidence,
        amount: ledgerTx.amount,
        availableFields: result.missingFields.length > 0
          ? ["orderId", "amount", "date"] // matches decisionPolicy's field-check shape
          : ["orderId", "amount", "date", "utr"],
      });
      explanation = explainerResult.reason;
    }

    const match = await Match.create({
      batchId,
      transactionIds: [ledgerTx._id],
      matchType: result.matchType, // "none" is now a real, honest enum value - see Match.js
      confidence: result.confidence,
      recommendedAction: result.recommendedAction,
      status,
      missingFields: result.missingFields,
      explanation: explanation || result.note,
      resolvedBy: status === "auto_resolved" ? "system" : null,
    });

    await Transaction.findByIdAndUpdate(ledgerTx._id, { matchStatus: status });

    await AuditLog.create({
      batchId,
      matchId: match._id,
      actor: "system",
      event: status === "auto_resolved" ? "auto_resolved" : "flagged_for_review",
      confidence: result.confidence,
      payload: { matchType: result.matchType, recommendedAction: result.recommendedAction },
    });
  }

  const matchRate = results.length > 0 ? round2((autoResolvedCount / results.length) * 100) : 0;

  await Batch.findByIdAndUpdate(batchId, { status: "complete", matchRate });

  await AuditLog.create({
    batchId,
    actor: "system",
    event: "batch_processed",
    payload: { totalOrders: results.length, autoResolvedCount, matchRate, summary },
  });

  return { matchRate, summary };
}

// Rough cause label for the template-fallback explainer, based on which
// matcher (if any) resolved the order and why. Not a substitute for the
// real per-reason `note` already attached in matchAll.js - just enough of
// a hint for explainException's existing template categories.
function inferCause(result) {
  if (result.matchType === "fuzzy") return "fee_mismatch";
  if (result.note && result.note.includes("not yet landed")) return "delayed_settlement";
  if (result.note && result.note.includes("duplicate")) return "duplicate";
  return "unknown_discrepancy";
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { runMatchingPipeline };
