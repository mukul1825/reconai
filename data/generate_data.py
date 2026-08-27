"""
generate_data.py — ReconAI synthetic dataset generator.

Produces three CSVs shaped like the real-world sources a merchant reconciles
(bank statement, Razorpay settlement report, internal ledger) plus a
ground_truth.json that records the *correct* answer for every order,
including which edge-case category it belongs to.

WHY THIS EXISTS (read this before you touch the matching engine):
Anyone can claim a matcher "works." The only way to prove it is to run it
against data where you already know the right answer, then measure the
diff. This script is what makes that possible - evaluate.py (Day 11) will
compare the matching engine's output against ground_truth.json and report
real precision/recall, not a vibe.

Reproducibility: same --seed always produces the same dataset. This matters
for the buildathon demo - your reported match rate must be reproducible by
a judge running this exact script, not a one-time lucky run.

SCHEMA NOTE (Day 6): settlement_report.csv column names follow Razorpay's
real Settlement Recon API terminology (entity_id, settlement_id,
settlement_utr, amount, fee, tax, credit) rather than invented names - see
docs/razorpay-schema-notes.md for the source and for the one deliberate
simplification this dataset makes (one settlement leg per order, rather than
fully modeling Razorpay's real batch-settlement structure where many orders
can share a single settlement_id/UTR).

Usage:
    python generate_data.py --n 100 --seed 42 --out sample_batch
"""

import argparse
import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

# Razorpay-realistic fee model: ~2% transaction fee + 18% GST on that fee.
# This is a simplification for the demo, documented here rather than hidden -
# defend it in Q&A as "representative, not claimed to be Razorpay's exact
# published rate."
FEE_RATE = 0.02
GST_ON_FEE = 0.18

# Category distribution - must sum to 1.0. Pulled directly from the Day 1
# blueprint so the dataset matches what was promised in the plan.
CATEGORY_WEIGHTS = {
    "exact": 0.70,
    "fee_mismatch": 0.15,
    "split_settlement": 0.07,
    "delayed_missing": 0.05,
    "duplicate": 0.03,
}

FIRST_NAMES = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Karan", "Isha", "Aditya", "Neha"]
LAST_NAMES = ["Sharma", "Patel", "Reddy", "Iyer", "Singh", "Gupta", "Nair", "Rao", "Mehta", "Kapoor"]

# Bank name pool for realistic NEFT narration text - format follows the
# documented real-world pattern "NEFT CR: [bank] [UTR] RAZORPAY SETTLEMENT".
BANKS = ["HDFC", "ICICI", "AXIS", "SBI", "KOTAK"]


def compute_fee_and_tax(gross_amount):
    fee = round(gross_amount * FEE_RATE, 2)
    tax = round(fee * GST_ON_FEE, 2)
    return fee, tax


def random_date(base_date, max_offset_days=0):
    return base_date + timedelta(days=random.randint(0, max_offset_days))


def gen_order_id(i):
    return f"order_{i:05d}"


def gen_entity_id(i):
    # Real Razorpay payment IDs look like pay_DEXrnipqTmWVGE - alnum, pay_ prefix
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    suffix = "".join(random.choice(chars) for _ in range(14))
    return f"pay_{suffix}"


def gen_settlement_id(i):
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    suffix = "".join(random.choice(chars) for _ in range(14))
    return f"setl_{suffix}"


def gen_utr(i):
    # Real settlement UTRs look like 1568176960vxp0rj - epoch-ish digits + alnum tail
    chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    tail = "".join(random.choice(chars) for _ in range(6))
    return f"{random.randint(10**9, 10**10 - 1)}{tail}"


def gen_customer_email():
    name = f"{random.choice(FIRST_NAMES).lower()}.{random.choice(LAST_NAMES).lower()}"
    return f"{name}{random.randint(1,999)}@example.com"


def gen_bank_narration(utr):
    bank = random.choice(BANKS)
    return f"NEFT CR: {bank} {utr} RAZORPAY SETTLEMENT"


def assign_categories(n):
    """Deterministically assign each order a category per CATEGORY_WEIGHTS,
    shuffled so categories aren't clustered by order_id (which would make the
    matching engine's job artificially easy or reveal the pattern by index)."""
    categories = []
    for cat, weight in CATEGORY_WEIGHTS.items():
        count = round(n * weight)
        categories.extend([cat] * count)
    while len(categories) < n:
        categories.append("exact")
    categories = categories[:n]
    random.shuffle(categories)
    return categories


def generate(n, seed, out_dir):
    random.seed(seed)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    base_date = datetime(2026, 8, 1)
    categories = assign_categories(n)

    ledger_rows = []
    settlement_rows = []
    bank_rows = []
    ground_truth = []

    for i, category in enumerate(categories):
        order_id = gen_order_id(i)
        gross_amount = round(random.uniform(299, 14999), 2)
        order_date = random_date(base_date, max_offset_days=25)
        fee, tax = compute_fee_and_tax(gross_amount)
        credit = round(gross_amount - fee - tax, 2)
        entity_id = gen_entity_id(i)
        settlement_id = gen_settlement_id(i)
        utr = gen_utr(i)
        settled_at = order_date + timedelta(days=random.randint(1, 3))

        ledger_rows.append({
            "order_id": order_id,
            "order_amount": gross_amount,
            "order_date": order_date.strftime("%Y-%m-%d"),
            "customer_email": gen_customer_email(),
        })

        gt_entry = {
            "order_id": order_id,
            "category": category,
            "expected_status": "resolved",
            "notes": "",
        }

        if category == "exact":
            settlement_rows.append({
                "entity_id": entity_id, "order_id": order_id,
                "settlement_id": settlement_id, "settlement_utr": utr,
                "amount": gross_amount, "fee": fee, "tax": tax, "credit": credit,
                "settled_at": settled_at.strftime("%Y-%m-%d"),
            })
            bank_rows.append({
                "date": settled_at.strftime("%Y-%m-%d"), "amount": credit,
                "utr": utr, "description": gen_bank_narration(utr),
            })
            gt_entry["expected_match_type"] = "exact"

        elif category == "fee_mismatch":
            # Fee/tax deduction happened, but the settlement report's fee/tax
            # fields are zeroed out - a real reporting gap. Naive amount
            # matching (ledger vs settlement) fails even though the money is
            # correct; the matcher has to recognize the ~fee-sized gap.
            settlement_rows.append({
                "entity_id": entity_id, "order_id": order_id,
                "settlement_id": settlement_id, "settlement_utr": utr,
                "amount": gross_amount, "fee": 0, "tax": 0, "credit": credit,
                "settled_at": settled_at.strftime("%Y-%m-%d"),
            })
            bank_rows.append({
                "date": settled_at.strftime("%Y-%m-%d"), "amount": credit,
                "utr": utr, "description": gen_bank_narration(utr),
            })
            gt_entry["expected_match_type"] = "fuzzy"
            gt_entry["notes"] = f"fee/tax not netted in settlement report (expected diff ~{fee + tax})"

        elif category == "split_settlement":
            # Order paid via two separate settlement legs (e.g. two payment
            # attempts completing one order). Disclosed simplification: real
            # Razorpay batches typically share ONE settlement_id/UTR across
            # many orders rather than splitting one order across two UTRs -
            # see docs/razorpay-schema-notes.md.
            split_ratio = random.uniform(0.35, 0.65)
            part1 = round(credit * split_ratio, 2)
            part2 = round(credit - part1, 2)
            utr2 = gen_utr(i + 100000)
            entity_id2 = gen_entity_id(i + 100000)
            settlement_id2 = gen_settlement_id(i + 100000)
            settled_at2 = settled_at + timedelta(days=1)

            for part_amount, u, eid, sid, sdate in [
                (part1, utr, entity_id, settlement_id, settled_at),
                (part2, utr2, entity_id2, settlement_id2, settled_at2),
            ]:
                settlement_rows.append({
                    "entity_id": eid, "order_id": order_id,
                    "settlement_id": sid, "settlement_utr": u,
                    "amount": round(gross_amount * split_ratio, 2), "fee": round(fee / 2, 2),
                    "tax": round(tax / 2, 2), "credit": part_amount,
                    "settled_at": sdate.strftime("%Y-%m-%d"),
                })
                bank_rows.append({
                    "date": sdate.strftime("%Y-%m-%d"), "amount": part_amount,
                    "utr": u, "description": gen_bank_narration(u),
                })
            gt_entry["expected_match_type"] = "split"
            gt_entry["notes"] = f"settled across 2 records: {utr}, {utr2}"

        elif category == "delayed_missing":
            # Settlement exists in the settlement report but the bank credit
            # hasn't landed in THIS batch's date window yet - legitimately
            # unmatched, not an error. Also drop the UTR from settlement
            # sometimes to simulate a reporting gap on top of the delay.
            drop_utr = random.random() < 0.5
            settlement_rows.append({
                "entity_id": entity_id, "order_id": order_id,
                "settlement_id": settlement_id,
                "settlement_utr": "" if drop_utr else utr,
                "amount": gross_amount, "fee": fee, "tax": tax, "credit": credit,
                "settled_at": settled_at.strftime("%Y-%m-%d"),
            })
            # Deliberately no corresponding bank_rows entry this cycle.
            gt_entry["expected_status"] = "pending_review"
            gt_entry["expected_match_type"] = "unmatched"
            gt_entry["notes"] = "bank credit not yet landed in this batch window" + (" + UTR missing" if drop_utr else "")

        elif category == "duplicate":
            settlement_rows.append({
                "entity_id": entity_id, "order_id": order_id,
                "settlement_id": settlement_id, "settlement_utr": utr,
                "amount": gross_amount, "fee": fee, "tax": tax, "credit": credit,
                "settled_at": settled_at.strftime("%Y-%m-%d"),
            })
            bank_row = {
                "date": settled_at.strftime("%Y-%m-%d"), "amount": credit,
                "utr": utr, "description": gen_bank_narration(utr),
            }
            bank_rows.append(bank_row)
            bank_rows.append(dict(bank_row))  # exact duplicate entry
            gt_entry["expected_match_type"] = "exact"
            gt_entry["notes"] = "duplicate bank entry injected - matcher must not double-count"

        ground_truth.append(gt_entry)

    # Shuffle bank/settlement rows so they aren't in suspiciously tidy
    # order_id order - a real bank statement isn't sorted by your order IDs.
    random.shuffle(bank_rows)
    random.shuffle(settlement_rows)

    _write_csv(out_dir / "ledger.csv", ledger_rows, ["order_id", "order_amount", "order_date", "customer_email"])
    _write_csv(out_dir / "settlement_report.csv", settlement_rows,
               ["entity_id", "order_id", "settlement_id", "settlement_utr", "amount", "fee", "tax", "credit", "settled_at"])
    _write_csv(out_dir / "bank_statement.csv", bank_rows, ["date", "amount", "utr", "description"])

    with open(out_dir / "ground_truth.json", "w") as f:
        json.dump({"seed": seed, "n_orders": n, "category_weights": CATEGORY_WEIGHTS, "orders": ground_truth}, f, indent=2)

    _print_summary(n, categories, out_dir)


def _write_csv(path, rows, fieldnames):
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _print_summary(n, categories, out_dir):
    counts = {cat: categories.count(cat) for cat in CATEGORY_WEIGHTS}
    print(f"\nGenerated {n} orders -> {out_dir}/")
    print("Category breakdown:")
    for cat, count in counts.items():
        pct = 100 * count / n
        print(f"  {cat:<18} {count:>4}  ({pct:.1f}%)")
    print("\nFiles written:")
    for name in ["ledger.csv", "settlement_report.csv", "bank_statement.csv", "ground_truth.json"]:
        print(f"  {out_dir / name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate ReconAI synthetic reconciliation dataset.")
    parser.add_argument("--n", type=int, default=100, help="Number of orders to generate (default: 100)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--out", type=str, default="sample_batch", help="Output directory (default: sample_batch)")
    args = parser.parse_args()

    generate(args.n, args.seed, args.out)
