"""Scoring rules for pack range, route fit, wear, readiness and business outcome."""

from __future__ import annotations

from math import floor
from typing import Any


def pack_usable_km(pack: dict[str, Any], scooter: dict[str, Any], reserve_soc_pct: float) -> int:
    soh = pack["testedSohPct"] / 100
    departure = pack["departureSocPct"] / 100
    reserve = reserve_soc_pct / 100
    usable_fraction = max(0.0, departure - reserve)
    raw = (
        pack["ratedUsableKwh"]
        * soh
        * usable_fraction
        * 1000
        / scooter["whPerKm"]
    )
    return floor(raw)


def rider_wear(rider: dict[str, Any]) -> dict[str, Any]:
    tracked_km = max(rider["trackedKm"], 1)
    damage_per_1000 = rider["damageIncidents"] / tracked_km * 1000
    high_load_per_100 = rider["highLoadEpisodes"] / tracked_km * 100

    damage_points = _clip((damage_per_1000 - 0) / (1 - 0) * 100, 0, 100)
    high_load_points = _clip((high_load_per_100 - 0.5) / (1.5 - 0.5) * 100, 0, 100)
    score = round(0.6 * damage_points + 0.4 * high_load_points)

    learning = (
        rider["trackedShifts"] < 10
        or rider["trackedKm"] < 300
        or rider["coveragePct"] < 80
        or not rider["peerDataReady"]
    )

    if learning:
        band = "learning"
    elif score <= 29:
        band = "low"
    elif score <= 69:
        band = "review"
    else:
        band = "elevated"

    return {
        "score": score,
        "band": band,
        "learning": learning,
        "damagePoints": round(damage_points),
        "highLoadPoints": round(high_load_points),
    }


def scooter_readiness(scooter: dict[str, Any]) -> int:
    inspection = scooter["inspectionPassPct"] / 100
    roadworthy = scooter["roadworthyDays"] / scooter["observedDays"]
    remaining = _clip(scooter["kmToService"] / scooter["serviceIntervalKm"], 0, 1)
    return round(100 * (0.50 * inspection + 0.30 * roadworthy + 0.20 * remaining))


def handover_action(wear: dict[str, Any], readiness: int) -> str:
    if wear["learning"]:
        return "assisted first handover"
    if wear["band"] == "low":
        return "standard handover"
    if readiness < 80:
        return "earlier follow-up check"
    if wear["band"] == "elevated":
        return "technician handover"
    return "documented handover"


def route_fit(
    *,
    usable_km: int,
    longest_leg_km: float,
    scooter: dict[str, Any],
    pack: dict[str, Any],
    daily_km: float,
) -> dict[str, Any]:
    if not scooter["dispatchClear"] or not pack["dispatchClear"]:
        return {
            "status": "hold",
            "marginKm": None,
            "supportsBooking": False,
            "label": "hold for inspection",
        }

    if scooter["kmToService"] < daily_km:
        return {
            "status": "service",
            "marginKm": None,
            "supportsBooking": False,
            "label": "service first",
        }

    margin = usable_km - longest_leg_km
    supports = margin >= 0
    if margin >= 0:
        label = f"{int(margin)} km to spare" if margin != 1 else "1 km to spare"
    else:
        short = abs(int(margin))
        label = f"{short} km short" if short != 1 else "1 km short"

    return {
        "status": "fit" if supports else "short",
        "marginKm": int(margin),
        "supportsBooking": supports,
        "label": label,
    }


def evaluate_assignment(
    fixture: dict[str, Any],
    *,
    long_range_to: str,
    outage: bool = False,
) -> dict[str, Any]:
    reserve = fixture["reserveSocPct"]
    packs = {p["id"]: p for p in fixture["packs"]}
    scooters = {s["id"]: {**s, "pack": packs[s["packId"]]} for s in fixture["scooters"]}

    # scooter x / p01 = 40 km, scooter y / p02 = 65 km
    scooter_x = scooters["x"]
    scooter_y = scooters["y"]
    range_x = pack_usable_km(scooter_x["pack"], scooter_x, reserve)
    range_y = pack_usable_km(scooter_y["pack"], scooter_y, reserve)

    long_scooter = scooter_y if range_y >= range_x else scooter_x
    short_scooter = scooter_x if long_scooter["id"] == "y" else scooter_y
    long_range = max(range_x, range_y)
    short_range = min(range_x, range_y)

    riders = {r["id"]: dict(r) for r in fixture["riders"]}
    if outage:
        out = fixture["outage"]
        riders[out["riderId"]]["longestLegKm"] = out["longestLegKm"]

    if long_range_to == "asha":
        assignment = {"asha": long_scooter, "ravi": short_scooter}
        ranges = {"asha": long_range, "ravi": short_range}
    else:
        assignment = {"asha": short_scooter, "ravi": long_scooter}
        ranges = {"asha": short_range, "ravi": long_range}

    pairings = []
    supported = 0
    for rider_id in ("asha", "ravi"):
        rider = riders[rider_id]
        scooter = assignment[rider_id]
        pack = scooter["pack"]
        usable = ranges[rider_id]
        wear = rider_wear(rider)
        readiness = scooter_readiness(scooter)
        fit = route_fit(
            usable_km=usable,
            longest_leg_km=rider["longestLegKm"],
            scooter=scooter,
            pack=pack,
            daily_km=rider["dailyKm"],
        )
        if fit["supportsBooking"]:
            supported += 1

        action = handover_action(wear, readiness)
        plain = _plain_language(rider, fit, action, usable)

        pairings.append(
            {
                "riderId": rider_id,
                "dailyKm": rider["dailyKm"],
                "longestLegKm": rider["longestLegKm"],
                "scooterId": scooter["id"],
                "packId": pack["id"],
                "usableKm": usable,
                "fit": fit,
                "wear": wear,
                "readiness": readiness,
                "handoverAction": action,
                "plainLanguage": plain,
                "scoreBreakdown": {
                    "wearFormula": "round(0.6 × damage points + 0.4 × high-load points)",
                    "damagePoints": wear["damagePoints"],
                    "highLoadPoints": wear["highLoadPoints"],
                    "readinessFormula": (
                        "round(100 × (0.50 × inspection + 0.30 × roadworthy days/observed "
                        "+ 0.20 × service remaining))"
                    ),
                    "readiness": readiness,
                    "rangeFormula": (
                        "floor(rated kWh × SOH × (departure − reserve) × 1000 ÷ Wh/km)"
                    ),
                },
            }
        )

    total = len(pairings)
    rent = supported * fixture["dailyRentInr"]
    note = None
    if outage and supported < total:
        note = "one booking needs another compatible pack or a different swap point."

    return {
        "longRangeTo": long_range_to,
        "outage": outage,
        "scaleMaxKm": 70,
        "pairings": pairings,
        "bookingsSupported": supported,
        "bookingsTotal": total,
        "grossRentInr": rent,
        "dailyRentInr": fixture["dailyRentInr"],
        "note": note,
        "scooterRanges": {
            "x": range_x,
            "y": range_y,
        },
    }


def _plain_language(
    rider: dict[str, Any],
    fit: dict[str, Any],
    action: str,
    usable: int,
) -> str:
    name = rider["id"].capitalize()
    if fit["status"] == "hold":
        return f"{name}'s scooter or pack is on hold for inspection."
    if fit["status"] == "service":
        return f"{name}'s scooter needs service before today's distance."
    if fit["supportsBooking"]:
        moment = (
            "before the next swap"
            if rider["id"] == "asha"
            else "before the finish"
        )
        return f"{fit['label']} {moment}. {action.capitalize()} recommended."
    return (
        f"{name} is {fit['label']} on a {usable} km pack for a "
        f"{int(rider['longestLegKm'])} km stretch. Reassign or find another pack."
    )


def _clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))
