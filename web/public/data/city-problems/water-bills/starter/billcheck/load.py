"""Already written for you: read the bills file."""
import csv


def read_bills(path="data/bills.csv"):
    """A list of dicts like {"account": "W102", "month": "2025-03", "amount": 60.0}."""
    bills = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            bills.append({
                "account": row["account"],
                "month": row["month"],
                "amount": float(row["amount"]),
            })
    return bills
