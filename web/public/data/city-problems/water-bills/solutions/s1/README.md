# Spot water bills that look wrong

(Sample problem. The resident and the bills are made up.)

Some neighbors get the exact same round-number water bill month after month, like $60.00, $60.00, $60.00. A real meter reading almost never lands on a round number again and again. It usually means the bill was estimated, not read. Your job is to find the accounts that look estimated, so those families know to ask for a meter read.

## The data

`data/bills.csv` has one row per account per month, for 12 months.

| column | what it is |
| --- | --- |
| account | a made-up account code, like `W102` |
| month | the month, like `2025-03` (sorts in the right order) |
| amount | the bill in dollars, like `60.00` |

## Already written for you

`billcheck/load.py` has `read_bills()`. It gives a list of dicts, like `{"account": "W102", "month": "2025-03", "amount": 60.0}`. The `amount` is a real number.

## What you write

Both functions go in `billcheck/check.py`.

### `longest_round_run(amounts, step=10)`

Takes a list of amounts for one account, in month order. Returns the longest streak of the same round amount in a row.

- An amount is round if it divides evenly by `step`. In Python: `amount % step == 0`.
- A streak is the same round amount again and again with nothing different in between.
- If no amount is round, return 0.

```python
longest_round_run([20, 20, 20, 33.1])   # 3
longest_round_run([20, 30, 20])         # 1  (20 and 30 are different)
longest_round_run([20, 20, 45, 20, 20]) # 2  (a streak is broken by 45)
longest_round_run([12.5, 12.5, 12.5])   # 0  (12.5 is not round)
```

### `find_suspicious(bills, min_months=3)`

Takes the list from `read_bills()`. Returns a list of account codes whose longest round streak is at least `min_months`. Sort the list. Each account shows up once. The rows of one account may not be in month order, so sort them by `month` first.

## Run it and test it

- Press **Run** to run `main.py`. It prints the accounts to check.
- Press **Run tests** to check your work.

## Tips

- Group the rows by account first. A dict of lists works well: `by_account.setdefault(account, []).append(row)`.
- To walk through a list and remember the last value, keep a variable like `previous` and update it each loop.
- Test `longest_round_run` on its own before you use it inside `find_suspicious`.
