from shelters.load import read_stops
from shelters.pick import score_stop, pick_shelters


def stop(stop_id, students, wait):
    return {"stop_id": stop_id, "students": students, "avg_wait_min": wait}


def test_score_is_students_times_wait():
    got = score_stop(stop("A", 10, 6))
    assert got == 60, f"10 students waiting 6 minutes should score 60, but you returned {got}"


def test_picks_the_highest_scores():
    stops = [stop("A", 10, 5), stop("B", 20, 5), stop("C", 5, 5)]
    got = pick_shelters(stops, how_many=2)
    assert got == ["B", "A"], f"B (100) and A (50) have the biggest scores, best first. You returned {got}"


def test_long_wait_beats_a_big_crowd():
    stops = [stop("A", 100, 2), stop("B", 30, 10)]
    got = pick_shelters(stops, how_many=1)
    assert got == ["B"], f"B scores 300 and A scores only 200, so B should win. You returned {got}"


def test_ties_go_to_the_smaller_stop_id():
    stops = [stop("B", 10, 10), stop("A", 20, 5), stop("C", 1, 1)]
    got = pick_shelters(stops, how_many=2)
    assert got == ["A", "B"], f"A and B both score 100, so A goes first. You returned {got}"


def test_real_data():
    got = pick_shelters(read_stops(), how_many=4)
    assert got == ["E02", "E04", "E01", "E05"], f"The best 4 are E02, E04, E01, E05 (in that order). You returned {got}"
