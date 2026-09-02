/**
 * Parses the three raw CSV sources into a common internal shape.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE MATCHING ENGINE:
 * The matching engine (exactMatch.js etc.) should never know or care that
 * its input came from a CSV - tomorrow it could be a live Razorpay API pull
 * or a different bank's export format. This file is the only place that
 * knows about column names. If a bank format changes, this is the only file
 * that changes.
 *
 * SETTLEMENT SCHEMA (Day 6): column names below follow Razorpay's real
 * Settlement Recon API terminology (entity_id, settlement_id,
 * settlement_utr, amount, fee, tax, credit) rather than invented names -
 * see docs/razorpay-schema-notes.md for the source and for the one
 * disclosed simplification this project makes (one settlement leg per
 * order, rather than fully modeling Razorpay's real batch-settlement
 * structure where many orders can share a single settlement_id/UTR).
 *
 * Each source is genuinely shaped differently in the real world:
 *   - ledger:     order_id, order_amount, order_date, customer_email
 *   - settlement: entity_id, order_id, settlement_id, settlement_utr,
 *                 amount (gross), fee, tax, credit (net), settled_at
 *   - bank:       date, amount, utr, description   (NO order_id, NO
 *                 entity_id - banks don't know about your orders, which is
 *                 exactly why reconciliation is a real problem and not a
 *                 trivial join)
 */

const { parse } = require("csv-parse/sync");

/**
 * Validates the parsed CSV has the columns a given source actually needs,
 * BEFORE any row reaches the database. Without this, a wrong-file-in-
 * wrong-slot mistake (e.g. uploading bank_statement.csv as the ledger)
 * surfaces as a raw Mongoose CastError - a real internals leak, not an
 * error state that tells the person what to do. This function is what
 * turns that into "this file doesn't look like a ledger export."
 */
function validateColumns(rows, requiredColumns, sourceLabel) {
  if (rows.length === 0) {
    throw new Error(`The ${sourceLabel} file is empty.`);
  }
  const actualColumns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((c) => !actualColumns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `This doesn't look like a ${sourceLabel} file - missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Check you selected the right file for this slot.`
    );
  }
}

function parseLedgerCsv(csvString) {
  const rows = parse(csvString, { columns: true, skip_empty_lines: true });
  validateColumns(rows, ["order_id", "order_amount", "order_date"], "ledger");
  return rows.map((r) => ({
    source: "ledger",
    orderId: r.order_id,
    amount: parseFloat(r.order_amount),
    date: r.order_date,
    utr: null,
    paymentId: null,
    fee: 0,
    tax: 0,
  }));
}

function parseSettlementCsv(csvString) {
  const rows = parse(csvString, { columns: true, skip_empty_lines: true });
  validateColumns(rows, ["entity_id", "order_id", "settlement_utr", "credit", "settled_at"], "settlement report");
  return rows.map((r) => ({
    source: "settlement",
    orderId: r.order_id,
    amount: parseFloat(r.credit), // net settled amount - what actually reconciles against the bank credit
    date: r.settled_at,
    utr: r.settlement_utr && r.settlement_utr.trim() !== "" ? r.settlement_utr : null,
    paymentId: r.entity_id,
    settlementId: r.settlement_id,
    fee: parseFloat(r.fee) || 0,
    tax: parseFloat(r.tax) || 0,
  }));
}

function parseBankCsv(csvString) {
  const rows = parse(csvString, { columns: true, skip_empty_lines: true });
  validateColumns(rows, ["date", "amount", "utr"], "bank statement");
  return rows.map((r) => ({
    source: "bank",
    orderId: null, // banks never carry our order IDs - this is expected, not missing data
    amount: parseFloat(r.amount),
    date: r.date,
    utr: r.utr && r.utr.trim() !== "" ? r.utr : null,
    paymentId: null,
    fee: 0,
    tax: 0,
  }));
}

module.exports = { parseLedgerCsv, parseSettlementCsv, parseBankCsv };
