from billcheck.load import read_bills
from billcheck.check import longest_round_run, find_suspicious


def make_bills(account, amounts):
    return [
        {"account": account, "month": f"2025-{i + 1:02d}", "amount": amount}
        for i, amount in enumerate(amounts)
    ]


def test_no_bills():
    got = find_suspicious([])
    assert got == [], f"With no bills there is nobody to flag, but you returned {got}"


def test_streak_of_the_same_round_amount():
    got = longest_round_run([50, 50, 50, 62.4])
    assert got == 3, f"50, 50, 50 is a streak of 3, but you returned {got}"
    got = longest_round_run([50, 50, 70, 50, 50])
    assert got == 2, f"The 70 breaks the streak, so the longest is 2. You returned {got}"


def test_odd_amounts_and_changing_amounts_do_not_count():
    got = longest_round_run([42.15, 42.15, 42.15])
    assert got == 0, f"42.15 is not a round number, so there is no streak. You returned {got}"
    got = longest_round_run([50, 60, 50])
    assert got == 1, f"50, 60 and 50 are all different in a row, so the longest streak is 1. You returned {got}"


def test_find_suspicious_small():
    bills = make_bills("A", [50, 50, 50, 41.3]) + make_bills("B", [50, 60, 50, 60])
    got = find_suspicious(bills)
    assert got == ["A"], f"Only account A repeats a round bill 3 months in a row, but you returned {got}"


def test_real_data():
    got = find_suspicious(read_bills())
    assert got == ["W102", "W104"], f"W102 (4 months of $60) and W104 (3 months of $80) should be flagged, and nobody else. You returned {got}"
