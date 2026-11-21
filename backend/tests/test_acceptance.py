"""Acceptance table checks from the build brief."""

from app.fixture import FIXTURE
from app.scoring import evaluate_assignment, pack_usable_km, rider_wear, scooter_readiness


def test_pack_ranges():
    packs = {p["id"]: p for p in FIXTURE["packs"]}
    scooters = {s["id"]: s for s in FIXTURE["scooters"]}
    assert pack_usable_km(packs["p01"], scooters["x"], FIXTURE["reserveSocPct"]) == 40
    assert pack_usable_km(packs["p02"], scooters["y"], FIXTURE["reserveSocPct"]) == 65


def test_wear_scores():
    riders = {r["id"]: r for r in FIXTURE["riders"]}
    asha = rider_wear(riders["asha"])
    ravi = rider_wear(riders["ravi"])
    assert asha["score"] == 84 and asha["band"] == "elevated"
    assert ravi["score"] == 12 and ravi["band"] == "low"


def test_readiness():
    scooters = {s["id"]: s for s in FIXTURE["scooters"]}
    assert scooter_readiness(scooters["x"]) == 94
    assert scooter_readiness(scooters["y"]) == 78


def _margins(result):
    by_id = {p["riderId"]: p for p in result["pairings"]}
    return by_id["asha"]["fit"]["marginKm"], by_id["ravi"]["fit"]["marginKm"]


def test_normal_asha_gets_65():
    result = evaluate_assignment(FIXTURE, long_range_to="asha", outage=False)
    asha_m, ravi_m = _margins(result)
    assert asha_m == 40
    assert ravi_m == -15
    assert result["bookingsSupported"] == 1
    assert result["grossRentInr"] == 250


def test_normal_ravi_gets_65():
    result = evaluate_assignment(FIXTURE, long_range_to="ravi", outage=False)
    asha_m, ravi_m = _margins(result)
    assert asha_m == 15
    assert ravi_m == 10
    assert result["bookingsSupported"] == 2
    assert result["grossRentInr"] == 500


def test_outage_asha_gets_65():
    result = evaluate_assignment(FIXTURE, long_range_to="asha", outage=True)
    asha_m, ravi_m = _margins(result)
    assert asha_m == 15
    assert ravi_m == -15
    assert result["bookingsSupported"] == 1
    assert result["grossRentInr"] == 250


def test_outage_ravi_gets_65():
    result = evaluate_assignment(FIXTURE, long_range_to="ravi", outage=True)
    asha_m, ravi_m = _margins(result)
    assert asha_m == -10
    assert ravi_m == 10
    assert result["bookingsSupported"] == 1
    assert result["grossRentInr"] == 250
