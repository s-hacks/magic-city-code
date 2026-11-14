"""Your part: find accounts that repeat the same round bill."""


def longest_round_run(amounts, step=10):
    """Longest streak of the same round amount in a row (0 if none are round).

    An amount is round if amount % step == 0.
    """
    best = 0
    run = 0
    previous = None
    for amount in amounts:
        if amount % step == 0:
            if amount == previous:
                run += 1
            else:
                run = 1
            previous = amount
            best = max(best, run)
        else:
            run = 0
            previous = None
    return best


def find_suspicious(bills, min_months=3):
    """Sorted list of account codes with a round streak of min_months or more."""
    by_account = {}
    for bill in bills:
        by_account.setdefault(bill["account"], []).append(bill)

    flagged = []
    for account, rows in by_account.items():
        rows.sort(key=lambda bill: bill["month"])
        amounts = [bill["amount"] for bill in rows]
        if longest_round_run(amounts) >= min_months:
            flagged.append(account)
    return sorted(flagged)
