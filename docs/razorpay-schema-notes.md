# Razorpay Settlement Schema — Alignment Notes (Day 6)

This document exists because the Day 1 project rules were explicit: **verify
official documentation, do not invent Razorpay API endpoints, and if a
required production capability is unavailable, label it as a simulation
rather than pretending it's live.** This is that disclosure, in one place,
so it can be pointed to directly in the README and in judge Q&A.

## What we verified against real sources

Razorpay's Settlement Recon API (documented in their official SDKs, e.g.
`razorpay-node`) returns settlement entities shaped like:

```json
{
  "entity_id": "pay_DEXrnipqTmWVGE",
  "type": "payment",
  "amount": 100000,
  "fee": 2900,
  "tax": 0,
  "credit": 97100,
  "settlement_id": "setl_DGlQ1Rj8os78Ec",
  "settlement_utr": "1568176960vxp0rj",
  "order_id": "order_DEXrnRiR3SNDHA"
}
```

(Amounts are in paise in the real API; our synthetic data uses rupees
directly for readability — documented here, not hidden.)

Separately, a practitioner writeup on Razorpay settlement reconciliation
describes the bank side: the NEFT credit narration typically reads
`NEFT CR: [bank] [UTR] RAZORPAY SETTLEMENT`, and **the correct match key is
the settlement_id, because Razorpay typically batches many orders into one
settlement and one bank credit** — not one order per bank credit.

Sources:
- `github.com/razorpay/razorpay-node/blob/master/documents/settlement.md`
- Terra Insight, "Razorpay Settlement Reconciliation: Unpacking Net Payouts"

## What we changed as a result

`data/generate_data.py` and `backend/src/services/matching/parseCsv.js` were
updated to use Razorpay's real field names instead of invented ones:

| Old (invented) | New (Razorpay's real term) |
|---|---|
| `payment_id` | `entity_id` |
| `utr` | `settlement_utr` |
| `settled_amount` | `credit` |
| `settlement_date` | `settled_at` |
| *(didn't exist)* | `settlement_id` *(added)* |
| *(gross amount didn't exist)* | `amount` *(added — gross, distinct from `credit`)* |

Bank statement narration was also changed to match the documented real
format: `NEFT CR: {bank} {utr} RAZORPAY SETTLEMENT`.

## The one disclosed simplification

Real Razorpay settlements batch **many orders into one settlement_id and
one bank UTR**. This project's `split_settlement` scenario instead models
**one order split across two separate settlement legs** (e.g. two payment
attempts completing a single order) — the reverse direction of the more
common real-world batching pattern.

**Why we made this call rather than modeling full batch-settlement:**
fully modeling many-orders-per-UTR would require restructuring the bank
statement to represent one bank credit per *entire settlement batch*
rather than per order, which changes what "a match" means throughout the
whole system - a genuinely bigger redesign than fits inside a 15-day solo
build without risking the Day 10 MVP deadline. The scenario we do model
(one order, two settlement legs) is still a real, valid reconciliation
edge case — just not the *most common* real pattern.

**If asked "why not model the real batching":** this is the honest answer.
It's a scoped, disclosed simplification made under a hard deadline, not
a claim that the system fully replicates Razorpay's settlement structure.
With more time, the natural next step (see the "30 more days" answer in
the Q&A prep) would be modeling settlement_id as the true batch key, with
one bank credit reconciling against N orders summed together.

## What did NOT need to change

The matching engine itself (`exactMatch.js`, `fuzzyMatch.js`,
`splitMatch.js`, `matchAll.js`) required **zero changes** for this
schema alignment. Only `parseCsv.js` — the one file whose whole job is
translating raw column names into the internal transaction shape — needed
updating. This is exactly the payoff of the Day 1 architecture decision to
keep matching logic decoupled from data source format: proven today, not
just claimed.
