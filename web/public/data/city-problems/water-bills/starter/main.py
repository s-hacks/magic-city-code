from billcheck.load import read_bills
from billcheck.check import find_suspicious

bills = read_bills()
accounts = {bill["account"] for bill in bills}
print("Bills in the file:", len(bills), "from", len(accounts), "accounts")

flagged = find_suspicious(bills)
print("Accounts that look estimated:", len(flagged))
for account in flagged:
    print(" ", account)
