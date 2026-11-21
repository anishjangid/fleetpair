# fleetpair — demo submission notes

## One-liner

**fleetpair** matches delivery riders to EV scooters and packs using real usage behaviour — so morning handovers protect bookings, service cost, and lease residual value.

---

## Problem statement

EV rental / lease hubs (Yulu, Zypp-style ops) hand out bikes every morning under pressure.

- Riders don’t run fixed routes. They have **usage patterns**: typical day km, longest gap between dependable swaps, wear from damage / high load.
- Packs have different **usable range** (capacity × SOH × charge − reserve). Scooters have different readiness.
- A wrong match means: stranded rider, lost rent for the day, harder wear on a weak pack, earlier workshop bills, and **resale / residual value** that slips.
- Ops tools today are often spreadsheets or “who looks free” — they don’t connect **behaviour → asset health → money**.
- Vehicle-level duty cycles are also the seed data OEMs and secondary markets need later — but hubs don’t capture that in a usable way.

**Core question the product answers**

> Given today’s riders and today’s assets, who should get which scooter/pack — and what should the hub manager do next about service and cost?

---

## Solution

**fleetpair** is a hub operator console for morning handover and ongoing fleet care.

1. **Match on behaviour, not fixed routes**  
   Pack usable km vs each rider’s observed swap gap. Critical conflict (e.g. Asha vs Ravi for the long pack) is explicit and switchable.

2. **Morning board (Home)**  
   Short checklist of what to do first: book bay, change rider, fix match — not dashboards of unexplained KPIs.

3. **Service & cost**  
   Issues raised from past rider/bike behaviour; spent this month vs expected next 30 days; predicted next service.

4. **Bikes / riders / rent**  
   Condition, open issues, residual at risk — with one-tap actions.

5. **Map**  
   Schematic of usual delivery zones around the hub with bike + rider labels and quick filters (service soon, value risk, hard use).

6. **Hub help (voice/text)**  
   Floor commands: “open map”, “bad bikes”, “fix long pack”.

---

## How location works (say this clearly in the demo)

| What it is | What it is not |
|---|---|
| Each rider has a **usual area** from tracked shifts (Koramangala/HSR, Whitefield, etc.) | Not live GPS tracking in this prototype |
| Map places the **assigned bike** in that rider’s zone relative to Indiranagar Hub | Matching does **not** use map distance |
| Matching uses **usage pattern**: typical day km + max swap gap vs pack usable km | Not “nearest bike to pin” |

**Talk track:**  
“Location on the map is zone context for the manager. The hard decision — who gets the long pack — is still about range vs behaviour. When we add live GPS later, the same board can show last ping; the scoring stays behaviour-first.”

---

## Demo flow (2–3 minutes)

1. **Login** → Home (**Morning board**): 3 numbers + checklist.  
2. Tap **Book bay** / **Change rider** — show actions, not slides.  
3. **Matches** — switch Asha/Ravi on the long pack; covered bookings / rent update.  
4. **Map** — filter “Service soon” / “Value risk”; open a bike.  
5. **Service** — spent vs next 30d; issues from past behaviour.  
6. Optional: mic → “open map” or “fix long pack”.

---

## Talking points (solutions you can defend)

### 1. Behaviour > routes
Delivery days aren’t scripted. Scoring on swap gap + day km survives messy real ops. Fixed routes would fake the problem.

### 2. One conflict teaches the system
Asha (dense swaps, high wear) vs Ravi (one long stretch) makes the long-pack decision visceral. Same logic scales to N riders × N assets.

### 3. Protect the lease book, not only today’s rent
Wrong pairing burns pack SOH and pulls service forward. Residual / “value at risk” connects ops to finance language.

### 4. Limited actionables
Home is a short job list. Managers don’t need another analytics wall — they need “do this / skip”.

### 5. Vehicle-level history is the OEM wedge
Every bike carries condition, stress, issues, service forecast. That’s the seed for reman / secondary-market proof later — even if this demo stops at hub ops.

### 6. Map is for situational awareness
Zones help the floor see who’s where; matching stays physics + behaviour. Honest about simulated positions.

### 7. Cost is forward-looking
“Spent this month” vs “expected next 30 days” from open issues + risk — managers can argue for bay time before failures.

---

## What we built (prototype scope)

- Next.js operator console + FastAPI scoring/challenge backend  
- Hub fixture: Indiranagar, multi-rider board, critical Asha/Ravi conflict  
- Health / longevity / residual / service-issue models (simulated, behaviour-grounded)  
- Home checklist, Matches, Service, Bikes, Riders, Rent, Map  
- Voice/text hub help  
- Mobile bottom nav + desktop side branch  

**Explicitly not production:** live GPS, real OEM API export, payments, multi-hub auth.

---

## Metrics to claim in the pitch (illustrative from the demo)

- Bookings covered after match (e.g. 6/6 when optimal)  
- Service expected next 30 days (₹)  
- Open issues / bikes due soon  
- Residual / value at risk on mismatched or stressed units  

Always frame as **simulated hub numbers** unless you wire live data.

---

## Suggested submission blurb (short)

> fleetpair helps EV rental hubs assign the right scooter and pack to each delivery rider using usage patterns — not fixed routes — then surfaces service timing, cost, and residual risk so the morning board protects both today’s rent and the lease book. A map of usual zones and a short action checklist keep the floor moving without another analytics wall.
