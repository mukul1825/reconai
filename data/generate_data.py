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


def compute_fee_and_tax(gross_amount):
    fee = round(gross_amount * FEE_RATE, 2)
    tax = round(fee * GST_ON_FEE, 2)
    return fee, tax


def random_date(base_date, max_offset_days=0):
    return base_date + timedelta(days=random.randint(0, max_offset_days))


def gen_order_id(i):
    return f"order_{i:05d}"


def gen_payment_id(i):
    return f"pay_{random.randint(10**13, 10**14 - 1)}"


def gen_utr(i):
    return f"UTR{random.randint(10**11, 10**12 - 1)}"


def gen_customer_email():
    name = f"{random.choice(FIRST_NAMES).lower()}.{random.choice(LAST_NAMES).lower()}"
    return f"{name}{random.randint(1,999)}@example.com"


def assign_categories(n):
    """Deterministically assign each order a category per CATEGORY_WEIGHTS,
    shuffled so categories aren't clustered by order_id (which would make the
    matching engine's job artificially easy or reveal the pattern by index)."""
    categories = []
    for cat, weight in CATEGORY_WEIGHTS.items():
        count = round(n * weight)
        categories.extend([cat] * count)
    # Pad/trim to exactly n in case rounding didn't land exactly
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
        settled_amount = round(gross_amount - fee - tax, 2)
        payment_id = gen_payment_id(i)
        utr = gen_utr(i)
        settlement_date = order_date + timedelta(days=random.randint(1, 3))

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
                "payment_id": payment_id, "order_id": order_id, "utr": utr,
                "settled_amount": settled_amount, "fee": fee, "tax": tax,
                "settlement_date": settlement_date.strftime("%Y-%m-%d"),
            })
            bank_rows.append({
                "date": settlement_date.strftime("%Y-%m-%d"), "amount": settled_amount,
                "utr": utr, "description": f"NEFT CR {utr}",
            })
            gt_entry["expected_match_type"] = "exact"

        elif category == "fee_mismatch":
            # Fee/tax deduction happened, but the settlement report's fee/tax
            # fields are zeroed out - a real reporting gap. Naive amount
            # matching (ledger vs settlement) fails even though the money is
            # correct; the matcher has to recognize the ~fee-sized gap.
            settlement_rows.append({
                "payment_id": payment_id, "order_id": order_id, "utr": utr,
                "settled_amount": settled_amount, "fee": 0, "tax": 0,
                "settlement_date": settlement_date.strftime("%Y-%m-%d"),
            })
            bank_rows.append({
                "date": settlement_date.strftime("%Y-%m-%d"), "amount": settled_amount,
                "utr": utr, "description": f"NEFT CR {utr}",
            })
            gt_entry["expected_match_type"] = "fuzzy"
            gt_entry["notes"] = f"fee/tax not netted in settlement report (expected diff ~{fee + tax})"

        elif category == "split_settlement":
            # Order paid via two settlement batches (e.g. staged payout).
            # Split roughly in half with a small random skew.
            split_ratio = random.uniform(0.35, 0.65)
            part1 = round(settled_amount * split_ratio, 2)
            part2 = round(settled_amount - part1, 2)
            utr2 = gen_utr(i + 100000)
            payment_id2 = gen_payment_id(i + 100000)
            settlement_date2 = settlement_date + timedelta(days=1)

            for part_amount, u, pid, sdate in [
                (part1, utr, payment_id, settlement_date),
                (part2, utr2, payment_id2, settlement_date2),
            ]:
                settlement_rows.append({
                    "payment_id": pid, "order_id": order_id, "utr": u,
                    "settled_amount": part_amount, "fee": round(fee / 2, 2), "tax": round(tax / 2, 2),
                    "settlement_date": sdate.strftime("%Y-%m-%d"),
                })
                bank_rows.append({
                    "date": sdate.strftime("%Y-%m-%d"), "amount": part_amount,
                    "utr": u, "description": f"NEFT CR {u}",
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
                "payment_id": payment_id, "order_id": order_id,
                "utr": "" if drop_utr else utr,
                "settled_amount": settled_amount, "fee": fee, "tax": tax,
                "settlement_date": settlement_date.strftime("%Y-%m-%d"),
            })
            # Deliberately no corresponding bank_rows entry this cycle.
            gt_entry["expected_status"] = "pending_review"
            gt_entry["expected_match_type"] = "unmatched"
            gt_entry["notes"] = "bank credit not yet landed in this batch window" + (" + UTR missing" if drop_utr else "")

        elif category == "duplicate":
            settlement_rows.append({
                "payment_id": payment_id, "order_id": order_id, "utr": utr,
                "settled_amount": settled_amount, "fee": fee, "tax": tax,
                "settlement_date": settlement_date.strftime("%Y-%m-%d"),
            })
            bank_row = {
                "date": settlement_date.strftime("%Y-%m-%d"), "amount": settled_amount,
                "utr": utr, "description": f"NEFT CR {utr}",
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
               ["payment_id", "order_id", "utr", "settled_amount", "fee", "tax", "settlement_date"])
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
