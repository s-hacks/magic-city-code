from drains.load import read_reports, read_inlets
from drains.rank import count_unique_reports, rank_inlets

reports = read_reports()
inlets = read_inlets()
print("Reports in the file:", len(reports))

counts = count_unique_reports(reports)
print("Inlets that were reported:", len(counts))

ranked = rank_inlets(reports, inlets)
print("Clear these first:")
for inlet_id in ranked[:5]:
    print(" ", inlet_id, inlets[inlet_id]["street"])
