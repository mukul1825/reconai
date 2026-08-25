/**
 * Parses the three raw CSV sources into a common internal shape.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE MATCHING ENGINE:
 * The matching engine (exactMatch.js) should never know or care that its
 * input came from a CSV - tomorrow it could be a live Razorpay API pull or
 * a different bank's export format. This file is the only place that knows
 * about column names. If a bank format changes, this is the only file that
 * changes.
 *
 * Each source is genuinely shaped differently in the real world:
 *   - ledger:     order_id, order_amount, order_date, customer_email
 *   - settlement: payment_id, order_id, utr, settled_amount, fee, tax, settlement_date
 *   - bank:       date, amount, utr, description   (NO order_id, NO payment_id -
 *                 banks don't know about your orders, which is exactly why
 *                 reconciliation is a real problem and not a trivial join)
 */

const { parse } = require("csv-parse/sync");

function parseLedgerCsv(csvString) {
  const rows = parse(csvString, { columns: true, skip_empty_lines: true });
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
  return rows.map((r) => ({
    source: "settlement",
    orderId: r.order_id,
    amount: parseFloat(r.settled_amount),
    date: r.settlement_date,
    utr: r.utr && r.utr.trim() !== "" ? r.utr : null,
    paymentId: r.payment_id,
    fee: parseFloat(r.fee) || 0,
    tax: parseFloat(r.tax) || 0,
  }));
}

function parseBankCsv(csvString) {
  const rows = parse(csvString, { columns: true, skip_empty_lines: true });
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
