"""Fleetpair API — fixture, assignment evaluation, shareable challenges."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .db import create_challenge, get_challenge, init_db
from .fixture import FIXTURE
from .scoring import evaluate_assignment, pack_usable_km, rider_wear, scooter_readiness

app = FastAPI(title="fleetpair", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EvaluateBody(BaseModel):
    longRangeTo: str = Field(pattern="^(asha|ravi)$")
    outage: bool = False


class ChallengeBody(BaseModel):
    longRangeTo: str = Field(pattern="^(asha|ravi)$")
    outage: bool = False
    bookingsSupported: int
    bookingsTotal: int = 2


@app.on_event("startup")  # lifespan alternative kept simple for hackathon
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/fixture")
def get_fixture() -> dict:
    reserve = FIXTURE["reserveSocPct"]
    packs = {p["id"]: p for p in FIXTURE["packs"]}
    scooters = []
    for s in FIXTURE["scooters"]:
        pack = packs[s["packId"]]
        scooters.append(
            {
                **s,
                "usableKm": pack_usable_km(pack, s, reserve),
                "readiness": scooter_readiness(s),
                "pack": pack,
            }
        )

    riders = []
    for r in FIXTURE["riders"]:
        riders.append({**r, "wear": rider_wear(r)})

    return {
        **FIXTURE,
        "riders": riders,
        "scooters": scooters,
        "scenarioLabel": "simulated hub",
        "title": "who gets the 65 km scooter?",
        "openingCopy": (
            "it’s 8 am at an EV rental hub. two delivery riders are waiting. "
            "their days aren’t fixed routes — fleetpair reads usage patterns "
            "from how they’ve been riding. one pack has 40 km usable range, "
            "the other 65 km."
        ),
    }


@app.post("/api/evaluate")
def evaluate(body: EvaluateBody) -> dict:
    return evaluate_assignment(
        FIXTURE,
        long_range_to=body.longRangeTo,
        outage=body.outage,
    )


@app.post("/api/challenges")
def post_challenge(body: ChallengeBody) -> dict:
    # Recompute so the stored result matches the rules.
    result = evaluate_assignment(
        FIXTURE,
        long_range_to=body.longRangeTo,
        outage=body.outage,
    )
    row = create_challenge(
        bookings_supported=result["bookingsSupported"],
        bookings_total=result["bookingsTotal"],
        long_range_to=body.longRangeTo,
        outage=body.outage,
    )
    return {
        "id": row.id,
        "bookingsSupported": row.bookings_supported,
        "bookingsTotal": row.bookings_total,
        "sharePath": f"/?demo=1&c={row.id}",
        "cardCopy": (
            f"my handover covered {row.bookings_supported} of "
            f"{row.bookings_total} bookings. can yours cover both?"
        ),
    }


@app.get("/api/challenges/{challenge_id}")
def read_challenge(challenge_id: str) -> dict:
    row = get_challenge(challenge_id)
    if row is None:
        raise HTTPException(status_code=404, detail="challenge not found")
    return {
        "id": row.id,
        "bookingsSupported": row.bookings_supported,
        "bookingsTotal": row.bookings_total,
        "longRangeTo": row.long_range_to,
        "outage": bool(row.outage),
        "cardCopy": (
            f"my handover covered {row.bookings_supported} of "
            f"{row.bookings_total} bookings. can yours cover both?"
        ),
        # Shared links open on the unanswered challenge.
        "openUnanswered": True,
    }
