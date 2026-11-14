"""Your part: count the reports, then rank the inlets."""


def count_unique_reports(reports):
    """Return {inlet_id: number of different days it was reported}.

    The same inlet on the same day counts once.
    """
    days = {}
    for report in reports:
        days.setdefault(report["inlet_id"], set()).add(report["date"])
    return {inlet_id: len(dates) for inlet_id, dates in days.items()}


def rank_inlets(reports, inlets):
    """Greedy: keep picking the worst inlet that is left."""
    counts = count_unique_reports(reports)
    left = sorted(counts)
    order = []
    while left:
        best = left[0]
        for inlet_id in left:
            score = counts[inlet_id] * inlets[inlet_id]["homes_downhill"]
            best_score = counts[best] * inlets[best]["homes_downhill"]
            if score > best_score:
                best = inlet_id
        order.append(best)
        left.remove(best)
    return order
