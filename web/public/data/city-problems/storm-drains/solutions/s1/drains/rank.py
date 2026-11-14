"""Your part: count the reports, then rank the inlets."""


def count_unique_reports(reports):
    """Return {inlet_id: number of different days it was reported}.

    The same inlet on the same day counts once.
    """
    seen = set()
    counts = {}
    for report in reports:
        key = (report["inlet_id"], report["date"])
        if key in seen:
            continue  # a repeat call for the same inlet and day
        seen.add(key)
        counts[report["inlet_id"]] = counts.get(report["inlet_id"], 0) + 1
    return counts


def rank_inlets(reports, inlets):
    """Return a list of inlet_ids, the one to fix first at the front.

    weight = homes_downhill (+5 if near_bus_stop)
    score  = different days reported x weight
    Biggest score first. Ties: smaller inlet_id first.
    Inlets with no reports are left out.
    """
    counts = count_unique_reports(reports)
    scores = {}
    for inlet_id, days in counts.items():
        info = inlets[inlet_id]
        weight = info["homes_downhill"]
        if info["near_bus_stop"]:
            weight += 5
        scores[inlet_id] = days * weight
    return sorted(scores, key=lambda inlet_id: (-scores[inlet_id], inlet_id))
