from drains.load import read_reports, read_inlets
from drains.rank import count_unique_reports, rank_inlets


def r(inlet_id, date="2025-03-01"):
    return {"inlet_id": inlet_id, "date": date}


def inlet(homes, bus=False):
    return {"homes_downhill": homes, "near_bus_stop": bus}


def test_no_reports():
    got = count_unique_reports([])
    assert got == {}, f"With no reports there is nothing to count, but you returned {got}"


def test_same_day_repeats_count_once():
    reports = [r("A", "2025-03-01"), r("A", "2025-03-01"), r("A", "2025-03-02"), r("B", "2025-03-01")]
    got = count_unique_reports(reports)
    assert got == {"A": 2, "B": 1}, f"A was reported on 2 different days and B on 1, but you returned {got}"


def test_reports_and_homes_both_matter():
    reports = [r("A", "2025-03-01"), r("A", "2025-03-02"), r("B"), r("C")]
    inlets = {"A": inlet(10), "B": inlet(15), "C": inlet(30)}
    got = rank_inlets(reports, inlets)
    # scores: C = 1 x 30, A = 2 x 10, B = 1 x 15
    assert got == ["C", "A", "B"], f"Expected ['C', 'A', 'B'] (scores 30, 20, 15) but you returned {got}"


def test_bus_stop_counts_extra():
    reports = [r("A"), r("B")]
    inlets = {"A": inlet(10), "B": inlet(6, bus=True)}
    got = rank_inlets(reports, inlets)
    # B's weight is 6 + 5 = 11, which beats A's 10
    assert got == ["B", "A"], f"A bus stop adds 5 to the weight, so B (11) should beat A (10). You returned {got}"


def test_real_data():
    reports = read_reports()
    inlets = read_inlets()
    ranked = rank_inlets(reports, inlets)
    assert len(ranked) == 11, f"11 inlets have reports, but your list has {len(ranked)}"
    assert "I11" not in ranked, "I11 has no reports, so it should not be in the list"
    assert set(ranked[:3]) == {"I05", "I10", "I03"}, f"The first three should be I05, I10 and I03 (in some order). You started with {ranked[:3]}"
