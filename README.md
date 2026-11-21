# fleetpair

match each delivery rider with a scooter and battery that can cover their shift — using **usage patterns** inferred from rider and vehicle behaviour, not fixed routes.

**[open the hub](http://localhost:3000)** · API `http://localhost:8000`

Demo login · `ananya@indiranagar.hub` / `fleetpair`

## who it’s for

hub managers and ops teams at electric two-wheeler rental fleets (Yulu / Zypp–style). morning handover is the product; the Asha/Ravi puzzle is the shareable demo inside it.

## what fleetpair reads

| signal | source | used for |
|---|---|---|
| typical day km | tracked rider shifts | workload |
| max swap gap | longest observed gap between dependable swaps | pack range needed |
| rider wear | damage / 1,000 km + high-load / 100 km | handover type |
| scooter readiness | inspection, roadworthy days, service remaining | dispatch clearance |
| pack usable km | kWh × SOH × (charge − reserve) ÷ Wh/km | fit vs swap gap |

delivery days aren’t scripted itineraries. areas drift; the match is against **behaviour**, then confirmed at the bay.

## product surfaces

1. **Hub board** — 6 riders × 6 scooters, KPIs (bookings, rent, rent at risk, special handovers), recommended plan, critical conflict panel, asset bay, handover drawer.
2. **20s challenge** — the viral “who gets the 65 km scooter?” beat for LinkedIn / demos (`/?demo=1`).

## run locally

```bash
# api
cd backend && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# web
cd frontend && npm install && npm run dev
```

acceptance (critical pair still matches the brief):

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest -q
```

| who gets 65 km? | asha margin | ravi margin | pair bookings | pair rent |
|---|---:|---:|---:|---:|
| asha | +40 | −15 | 1 of 2 | ₹250 |
| ravi | +15 | +10 | 2 of 2 | ₹500 |

on the full hub board, that same switch moves **5/6 → 6/6** bookings when the rest of the bay is auto-matched.

## stack

Next.js · FastAPI · SQLite challenge links · local behaviour fixture

## launch copy

see `fleetpair-launch-copy.md`. replace `DEMO_URL` / `REPO_URL` when hosted.
