# who gets the 65 km scooter?

**cursor build brief · solo hackathon · 120 minutes**

> build a mobile-first, single-page ev rental challenge from this brief. use the sample data below. ship the choice, route reveal, switch action, scoring explanation and shareable link first. verify both baseline assignments against the acceptance table before adding the optional station outage. use the existing project stack, or start with vite, react and typescript in an empty project.

## the experience to ship

a visitor plays the person handing out scooters at an ev rental hub. in 20 seconds they should make a choice, see its consequence for both riders and want to challenge a friend. a fleet operator should also be able to open the result and understand the recommended handover.

**opening screen copy**

> it’s 8 am. asha will ride 100 km today. ravi will ride 55 km. both scooters are fully charged. one has 40 km of usable range and the other has 65 km. who gets the 65 km scooter?

use **give it to asha** and **give it to ravi** as the two primary choices. the other rider automatically receives the remaining scooter and its fitted pack. **view routes** lets a visitor inspect the evidence before choosing. a small **simulated hub** label stays visible.

## the interaction and visual design

| state | what to show | interaction |
|---|---|---|
| choose | two rider cards, with first name and daily km in large type. route details show a 25 km gap between dependable swaps for asha and a 55 km stretch to the finish for ravi. | tapping a choice immediately assigns both scooters and reveals the result. keep the initial state unanswered. |
| reveal | two route bars on the same 0–70 km scale. the bar ends at usable pack range. a marker identifies the next dependable swap or the end of the shift. label the gap in words, such as **15 km short** or **10 km to spare**. | **switch scooters** reverses both assignments and updates both bars, the number of bookings supported and the rupee amount together. |
| explain | a **why this match?** drawer shows rider wear, scooter readiness, fitted pack and one next action. default to a plain-language explanation. expand to see how a score was calculated. | for asha on the 40 km scooter, show **15 km to spare before the next swap. technician handover recommended.** |
| share or replay | a screenshot-friendly card shows the visitor’s result, a challenge prompt and the simulated scenario label. keep individual wear scores in the operations drawer. | **challenge someone** copies a playable link. **play again** returns to an unanswered challenge. |

design for a 390 px phone first. keep the question and both choices visible in the opening view. use a warm off-white background, dark text, teal for a fit and amber for a shortfall. pair colours with labels and use tap targets at least 44 px high. on desktop, keep the two route bars aligned for projection. any animation should also make sense in a silent screen recording.

## canonical demo data

keep these inputs in one local fixture. derive the numbers shown in the interface from it. this is a one-day view with ₹250 of illustrative gross rent per supported booking. both scooters and packs start cleared for dispatch.

```json
{
  "dailyRentInr": 250,
  "reserveSocPct": 10,
  "riders": [
    {"id":"asha","dailyKm":100,"longestLegKm":25,"trackedShifts":20,"trackedKm":2000,"coveragePct":95,"damageIncidents":2,"highLoadEpisodes":22,"peerDataReady":true},
    {"id":"ravi","dailyKm":55,"longestLegKm":55,"trackedShifts":16,"trackedKm":1000,"coveragePct":94,"damageIncidents":0,"highLoadEpisodes":8,"peerDataReady":true}
  ],
  "scooters": [
    {"id":"x","packId":"p01","dispatchClear":true,"inspectionPassPct":98,"roadworthyDays":29,"observedDays":30,"kmToService":2400,"serviceIntervalKm":3000,"whPerKm":36},
    {"id":"y","packId":"p02","dispatchClear":true,"inspectionPassPct":90,"roadworthyDays":28,"observedDays":30,"kmToService":750,"serviceIntervalKm":3000,"whPerKm":37}
  ],
  "packs": [
    {"id":"p01","dispatchClear":true,"ratedUsableKwh":2,"testedSohPct":80,"departureSocPct":100},
    {"id":"p02","dispatchClear":true,"ratedUsableKwh":3,"testedSohPct":90,"departureSocPct":100}
  ],
  "outage": {"riderId":"asha","longestLegKm":50}
}
```

the fixture is sufficient to finish the build. if a shareable real two-wheeler aggregate is ready in the first ten minutes, it can appear as a separately labelled reference in the drawer. keep the public puzzle reproducible. use fictional riders and pack ids. the sample diagnostic represents a hub battery test. [batteryok diagnostic reference](https://batteryok.in/EV_DOCTOR_PROFILE.pdf)

## rules cursor should implement

1. **pack range.** convert percentages to fractions. usable km = floor of rated usable kWh × tested state of health × max(0, departure charge − reserve charge) × 1,000 ÷ Wh/km. this yields **40 km for x/p01** and **65 km for y/p02**. usable range already includes the reserve.
2. **route fit.** range margin = usable km − rider’s longest leg between reliable swaps or the finish. zero is a fit. if either the scooter or fitted pack is on hold, show **hold for inspection**. if required service falls before the day’s distance, show **service first**. otherwise, a nonnegative margin supports the booking. count each scooter and pack once.
3. **rider wear.** use confirmed damage per 1,000 tracked km and reviewed high-load episodes per 100 tracked km. for this demo, normalise damage linearly from 0 to 1 incident per 1,000 km and high load from 0.5 to 1.5 episodes per 100 km. each becomes 0–100 points, clipped at both ends. wear = round(0.6 × damage points + 0.4 × high-load points). **asha = 84, elevated. ravi = 12, low.** low is 0–29, review is 30–69, elevated is 70–100. use **learning** with fewer than 10 tracked shifts, fewer than 300 tracked km, coverage below 80% or missing comparable peer data. daily distance describes workload. a rider’s wear band guides support at handover.
4. **scooter readiness.** use fractions for each input. readiness = round(100 × (0.50 × inspection pass rate + 0.30 × roadworthy days / observed days + 0.20 × fraction of the service interval remaining)). clamp the remaining interval fraction to 0–1. **x = 94/100. y = 78/100.** for an eligible pairing, low wear gets a standard handover and learning gets an assisted first handover. review or elevated wear on a scooter below 80 gets an earlier follow-up check. at readiness 80 or above, elevated wear gets a technician handover and review gets a documented handover.
5. **business outcome.** show **bookings supported today** and **simulated gross rent supported today**. multiply supported bookings by ₹250. the rental amount represents what the hub could bill if eligible bookings start. operating costs and long-term battery life sit outside this one-day calculation.

## acceptance table

| scenario | 65 km scooter goes to | asha’s margin | ravi’s margin | supported | gross rent supported |
|---|---|---:|---:|---:|---:|
| normal morning | asha | +40 km | −15 km | 1 of 2 | ₹250 |
| normal morning | ravi | +15 km | +10 km | 2 of 2 | ₹500 |
| optional outage | asha | +15 km | −15 km | 1 of 2 | ₹250 |
| optional outage | ravi | −10 km | +10 km | 1 of 2 | ₹250 |

**the optional twist.** after the first reveal, offer **swap station offline**. asha now needs 50 km between dependable swaps. both riders need the longer-range pack. show **one booking needs another compatible pack or a different swap point.** turning the switch off restores the original gaps and totals.

**final checks.** try both choices on a phone, switch twice, and reopen a shared link in a fresh tab. confirm that the link opens on the unanswered question, with optional scenario id only. changing a rider to learning should preserve a feasible booking. putting a fitted pack on hold should remove its booking from the total even if the range fits. a visitor should understand the 15 km shortfall with sound muted.

## two-hour build order

| minutes | priority | exit check |
|---|---|---|
| 0–15 | choose the stack, add the fixture and sketch the mobile view | the two baseline outcomes can be verified by hand |
| 15–40 | build opening copy, rider cards, view routes and both choice buttons | a visitor can choose on a phone unaided |
| 40–65 | connect assignments, route bars, switching and gross rent | both baseline rows in the acceptance table pass |
| 65–85 | build the scoring drawer and handover actions | each recommendation has a readable reason |
| 85–100 | prepare the share card and challenge link, then put the build on the chosen host | opening the link in a new tab starts a fresh challenge |
| 100–120 | test on mobile, record a 20-second silent walkthrough and rehearse | the link and backup recording are ready to present |

use client-side state and local data for the full journey. if time gets tight, prioritise the baseline puzzle, drawer and copy-link action. the outage toggle and downloadable image are stretch features. the on-screen card works as a screenshot.

## presentation and linkedin handoff

**60-second demo.** ask the room who gets the 65 km scooter. give it to asha and pause on ravi’s 15 km shortfall. switch the scooters and show both bookings becoming viable. open the drawer to explain why asha still gets a technician handover. close by asking whether better handovers can increase paid rental days per scooter while reducing unplanned workshop visits.

**linkedin opening for launch**

> one delivery rider covers 100 km a day. another covers 55. i have one scooter with 65 km of usable range. who would you give it to?
>
> i built a 20-second version of that decision. pick a rider, then see what happens to the other one’s shift.

the result card can read **my handover covered 2 of 2 routes. your turn.** substitute the actual count for each outcome. share the unanswered puzzle so the next person gets to make their own call.
