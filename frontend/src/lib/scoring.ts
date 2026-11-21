import { FIXTURE } from "./fixture";
import type {
  AssignmentMap,
  EvaluateResult,
  FitResult,
  Fixture,
  FloorRider,
  FreeBike,
  HubResult,
  Pack,
  Pairing,
  Rider,
  Scooter,
  UsagePattern,
  WearResult,
} from "./types";

function clip(value: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, value));
}

export function packUsableKm(
  pack: Pack,
  scooter: Scooter,
  reserveSocPct: number,
): number {
  const soh = pack.testedSohPct / 100;
  const departure = pack.departureSocPct / 100;
  const reserve = reserveSocPct / 100;
  const usableFraction = Math.max(0, departure - reserve);
  return Math.floor(
    (pack.ratedUsableKwh * soh * usableFraction * 1000) / scooter.whPerKm,
  );
}

export function riderWear(rider: Rider): WearResult {
  const trackedKm = Math.max(rider.trackedKm, 1);
  const damagePer1000 = (rider.damageIncidents / trackedKm) * 1000;
  const highLoadPer100 = (rider.highLoadEpisodes / trackedKm) * 100;
  const damagePoints = clip((damagePer1000 / 1) * 100, 0, 100);
  const highLoadPoints = clip(((highLoadPer100 - 0.5) / 1) * 100, 0, 100);
  const score = Math.round(0.6 * damagePoints + 0.4 * highLoadPoints);
  const learning =
    rider.trackedShifts < 10 ||
    rider.trackedKm < 300 ||
    rider.coveragePct < 80 ||
    !rider.peerDataReady;

  let band: WearResult["band"] = "elevated";
  if (learning) band = "learning";
  else if (score <= 29) band = "low";
  else if (score <= 69) band = "review";

  return {
    score,
    band,
    learning,
    damagePoints: Math.round(damagePoints),
    highLoadPoints: Math.round(highLoadPoints),
  };
}

export function scooterReadiness(scooter: Scooter): number {
  const inspection = scooter.inspectionPassPct / 100;
  const roadworthy = scooter.roadworthyDays / scooter.observedDays;
  const remaining = clip(
    scooter.kmToService / scooter.serviceIntervalKm,
    0,
    1,
  );
  return Math.round(
    100 * (0.5 * inspection + 0.3 * roadworthy + 0.2 * remaining),
  );
}

function handoverAction(wear: WearResult, readiness: number): string {
  if (wear.learning) return "assisted first handover";
  if (wear.band === "low") return "standard handover";
  if (readiness < 80) return "earlier follow-up check";
  if (wear.band === "elevated") return "technician handover";
  return "documented handover";
}

function routeFit(args: {
  usableKm: number;
  longestLegKm: number;
  scooter: Scooter;
  pack: Pack;
  dailyKm: number;
}): FitResult {
  const { usableKm, longestLegKm, scooter, pack, dailyKm } = args;
  if (!scooter.dispatchClear || !pack.dispatchClear) {
    return {
      status: "hold",
      marginKm: null,
      supportsBooking: false,
      label: "hold for inspection",
    };
  }
  if (scooter.kmToService < dailyKm) {
    return {
      status: "service",
      marginKm: null,
      supportsBooking: false,
      label: "service first",
    };
  }
  const margin = usableKm - longestLegKm;
  const supports = margin >= 0;
  const abs = Math.abs(Math.trunc(margin));
  return {
    status: supports ? "fit" : "short",
    marginKm: Math.trunc(margin),
    supportsBooking: supports,
    label: margin >= 0 ? `${abs} km to spare` : `${abs} km short`,
  };
}

export function inferUsagePattern(rider: Rider): UsagePattern {
  const wear = riderWear(rider);
  const gap = rider.longestLegKm;
  const day = rider.dailyKm;

  let label: string;
  let detail: string;

  if (wear.learning) {
    label = "Thin history";
    detail =
      "Few tracked shifts. Treat swap gap as provisional.";
  } else if (gap >= day * 0.85) {
    label = "Long single-pack stretch";
    detail = "Long gaps between swaps. Needs enough range.";
  } else if (gap <= 30 && day >= 80) {
    label = "Dense swap habit";
    detail = "High day km, short gaps. Mid-range pack is fine.";
  } else if (wear.band === "elevated") {
    label = "Hard usage pattern";
    detail = "High wear. Pair with a ready bike.";
  } else {
    label = "Steady delivery pattern";
    detail = "Stable distance and swap gaps.";
  }

  const historyDepth = wear.learning
    ? `<${rider.trackedShifts} shifts · learning`
    : `${rider.trackedShifts} shifts · ${rider.trackedKm} km tracked`;

  return {
    label,
    detail,
    typicalDayKm: day,
    maxSwapGapKm: gap,
    historyDepth,
  };
}

function plainLanguage(
  rider: Rider,
  fit: FitResult,
  action: string,
  usable: number,
): string {
  if (fit.status === "hold") {
    return `${rider.name}'s scooter or pack is on hold for inspection.`;
  }
  if (fit.status === "service") {
    return `${rider.name}'s scooter needs service before today's distance.`;
  }
  if (fit.supportsBooking) {
    const moment =
      rider.longestLegKm < rider.dailyKm
        ? "before the next dependable swap"
        : "across the observed stretch";
    return `${fit.label} ${moment}. ${action.charAt(0).toUpperCase()}${action.slice(1)} recommended.`;
  }
  return `${rider.name} is ${fit.label} on a ${usable} km pack for an observed ${Math.trunc(rider.longestLegKm)} km gap between swaps. Reassign or find another pack.`;
}

type Asset = {
  scooter: Scooter;
  pack: Pack;
  usableKm: number;
  readiness: number;
};

function buildAssets(fixture: Fixture): Asset[] {
  const packs = Object.fromEntries(fixture.packs.map((p) => [p.id, p]));
  return fixture.scooters.map((scooter) => {
    const pack = packs[scooter.packId];
    return {
      scooter,
      pack,
      usableKm: packUsableKm(pack, scooter, fixture.reserveSocPct),
      readiness: scooterReadiness(scooter),
    };
  });
}

function buildPairing(rider: Rider, asset: Asset): Pairing {
  const wear = riderWear(rider);
  const pattern = inferUsagePattern(rider);
  const fit = routeFit({
    usableKm: asset.usableKm,
    longestLegKm: rider.longestLegKm,
    scooter: asset.scooter,
    pack: asset.pack,
    dailyKm: rider.dailyKm,
  });
  const action = handoverAction(wear, asset.readiness);
  return {
    riderId: rider.id,
    riderName: rider.name,
    usualArea: rider.usualArea,
    dailyKm: rider.dailyKm,
    longestLegKm: rider.longestLegKm,
    pattern,
    scooterId: asset.scooter.id,
    scooterLabel: asset.scooter.label,
    packId: asset.pack.id,
    packLabel: asset.pack.label,
    usableKm: asset.usableKm,
    fit,
    wear,
    readiness: asset.readiness,
    handoverAction: action,
    plainLanguage: plainLanguage(rider, fit, action, asset.usableKm),
  };
}

/** Best free bike for a waiting rider - longest pack that covers their swap gap. */
export function suggestBikeForRider(
  rider: Rider,
  freeAssets: Asset[],
): Asset | null {
  if (freeAssets.length === 0) return null;
  const sorted = [...freeAssets].sort((a, b) => b.usableKm - a.usableKm);
  const fit = sorted.find((a) => a.usableKm >= rider.longestLegKm);
  return fit ?? sorted[0];
}

export function cloneAssignments(map: AssignmentMap): AssignmentMap {
  return { ...map };
}

/**
 * Live floor: riders wait, get a bike, go out, come back anytime.
 * `assignments` is riderId → scooterId | null (null = waiting at hub).
 */
export function evaluateHub(
  fixture: Fixture = FIXTURE,
  assignments: AssignmentMap = fixture.initialAssignments,
  outage = false,
): HubResult {
  const riders: Rider[] = fixture.riders.map((r) => {
    if (outage && r.id === fixture.outage.riderId) {
      return { ...r, longestLegKm: fixture.outage.longestLegKm };
    }
    return { ...r };
  });
  const ridersById = Object.fromEntries(riders.map((r) => [r.id, r]));
  const assets = buildAssets(fixture);
  const byScooter = Object.fromEntries(assets.map((a) => [a.scooter.id, a]));

  const usedScooterIds = new Set(
    Object.values(assignments).filter((id): id is string => !!id),
  );
  const freeAssets = assets.filter((a) => !usedScooterIds.has(a.scooter.id));
  const freeBikes: FreeBike[] = freeAssets.map((a) => ({
    scooterId: a.scooter.id,
    scooterLabel: a.scooter.label,
    packLabel: a.pack.label,
    usableKm: a.usableKm,
    readiness: a.readiness,
  }));

  const pairings: Pairing[] = [];
  for (const [riderId, scooterId] of Object.entries(assignments)) {
    if (!scooterId) continue;
    const rider = ridersById[riderId];
    const asset = byScooter[scooterId];
    if (!rider || !asset) continue;
    pairings.push(buildPairing(rider, asset));
  }

  const floor: FloorRider[] = riders.map((rider) => {
    const assigned = assignments[rider.id];
    const status =
      assigned === undefined
        ? "off"
        : assigned === null
          ? "waiting"
          : "out";
    const pairing =
      status === "out"
        ? pairings.find((p) => p.riderId === rider.id) ?? null
        : null;
    const suggestion =
      status === "waiting" ? suggestBikeForRider(rider, freeAssets) : null;
    const suggestedFit = suggestion
      ? routeFit({
          usableKm: suggestion.usableKm,
          longestLegKm: rider.longestLegKm,
          scooter: suggestion.scooter,
          pack: suggestion.pack,
          dailyKm: rider.dailyKm,
        })
      : null;

    return {
      riderId: rider.id,
      riderName: rider.name,
      usualArea: rider.usualArea,
      dailyKm: rider.dailyKm,
      longestLegKm: rider.longestLegKm,
      pattern: inferUsagePattern(rider),
      wear: riderWear(rider),
      status,
      pairing,
      suggestedScooterId: suggestion?.scooter.id ?? null,
      suggestedScooterLabel: suggestion?.scooter.label ?? null,
      suggestedUsableKm: suggestion?.usableKm ?? null,
      suggestedFit,
    };
  });

  const active = pairings;
  const supported = active.filter((p) => p.fit.supportsBooking).length;
  const waitingCount = floor.filter((f) => f.status === "waiting").length;
  const outCount = floor.filter((f) => f.status === "out").length;
  const techHandovers = active.filter(
    (p) =>
      p.fit.supportsBooking &&
      (p.handoverAction === "technician handover" ||
        p.handoverAction === "assisted first handover" ||
        p.handoverAction === "documented handover" ||
        p.handoverAction === "earlier follow-up check"),
  ).length;

  let note: string | null = null;
  if (waitingCount > 0 && freeBikes.length === 0) {
    note = `${waitingCount} waiting, no free bikes.`;
  } else if (waitingCount > 0) {
    note = `${waitingCount} waiting, ${freeBikes.length} free.`;
  } else if (supported < active.length) {
    const short = active.find((p) => !p.fit.supportsBooking);
    note = short
      ? `${short.riderName} is short on range. Swap before they leave.`
      : null;
  }

  return {
    hubName: fixture.hubName,
    shiftLabel: fixture.shiftLabel,
    outage,
    scaleMaxKm: 70,
    pairings: active,
    floor,
    freeBikes,
    waitingCount,
    outCount,
    bookingsSupported: supported,
    bookingsTotal: Math.max(active.length, 1),
    grossRentInr: supported * fixture.dailyRentInr,
    dailyRentInr: fixture.dailyRentInr,
    techHandovers,
    rentAtRiskInr:
      (active.length - supported + waitingCount) * fixture.dailyRentInr,
    note,
  };
}

/** Auto-assign every waiting rider to the best free bike. */
export function autoAssignWaiting(
  fixture: Fixture,
  assignments: AssignmentMap,
): AssignmentMap {
  const next = cloneAssignments(assignments);
  const ridersById = Object.fromEntries(fixture.riders.map((r) => [r.id, r]));
  const assets = buildAssets(fixture);
  const byScooter = Object.fromEntries(assets.map((a) => [a.scooter.id, a]));

  const waiting = Object.entries(next)
    .filter(([, s]) => s === null)
    .map(([id]) => ridersById[id])
    .filter(Boolean)
    .sort((a, b) => b.longestLegKm - a.longestLegKm);

  for (const rider of waiting) {
    const used = new Set(
      Object.values(next).filter((id): id is string => !!id),
    );
    const free = assets.filter((a) => !used.has(a.scooter.id));
    const pick = suggestBikeForRider(rider, free);
    if (pick) next[rider.id] = pick.scooter.id;
  }

  // Ensure suggested bikes still exist in map for type safety
  void byScooter;
  return next;
}

export function assignRider(
  assignments: AssignmentMap,
  riderId: string,
  scooterId: string,
): AssignmentMap {
  const next = cloneAssignments(assignments);
  // Free whoever currently has this bike
  for (const [rid, sid] of Object.entries(next)) {
    if (sid === scooterId) next[rid] = null;
  }
  next[riderId] = scooterId;
  return next;
}

export function releaseRider(
  assignments: AssignmentMap,
  riderId: string,
): AssignmentMap {
  const next = cloneAssignments(assignments);
  if (riderId in next) next[riderId] = null;
  return next;
}

export function checkInRider(
  assignments: AssignmentMap,
  riderId: string,
): AssignmentMap {
  const next = cloneAssignments(assignments);
  if (!(riderId in next) || next[riderId] === undefined) {
    next[riderId] = null;
  }
  return next;
}

/** Legacy 2-rider evaluator kept for challenge share + acceptance. */
export function evaluateAssignment(
  fixture: Fixture = FIXTURE,
  longRangeTo: "asha" | "ravi",
  outage = false,
): EvaluateResult {
  const [critA, critB] = fixture.criticalRiderIds;
  const assets = buildAssets(fixture);
  const sorted = [...assets].sort((a, b) => b.usableKm - a.usableKm);
  const longAsset = sorted[0];
  const shortAsset = sorted[sorted.length - 1];
  const assignments: AssignmentMap = {
    [critA]: longRangeTo === critA ? longAsset.scooter.id : shortAsset.scooter.id,
    [critB]: longRangeTo === critB ? longAsset.scooter.id : shortAsset.scooter.id,
  };
  const hub = evaluateHub(fixture, assignments, outage);
  const critical = hub.pairings.filter((p) =>
    fixture.criticalRiderIds.includes(p.riderId),
  );
  return {
    longRangeTo,
    outage,
    scaleMaxKm: hub.scaleMaxKm,
    pairings: critical.map((p) => ({
      riderId: p.riderId,
      dailyKm: p.dailyKm,
      longestLegKm: p.longestLegKm,
      scooterId: p.scooterId,
      packId: p.packId,
      usableKm: p.usableKm,
      fit: p.fit,
      wear: p.wear,
      readiness: p.readiness,
      handoverAction: p.handoverAction,
      plainLanguage: p.plainLanguage,
      scoreBreakdown: {
        wearFormula: "round(0.6 × damage points + 0.4 × high-load points)",
        damagePoints: p.wear.damagePoints,
        highLoadPoints: p.wear.highLoadPoints,
        readinessFormula:
          "round(100 × (0.50 × inspection + 0.30 × roadworthy days/observed + 0.20 × service remaining))",
        readiness: p.readiness,
        rangeFormula:
          "floor(rated kWh × SOH × (departure − reserve) × 1000 ÷ Wh/km)",
      },
    })),
    bookingsSupported: critical.filter((p) => p.fit.supportsBooking).length,
    bookingsTotal: critical.length,
    grossRentInr:
      critical.filter((p) => p.fit.supportsBooking).length *
      fixture.dailyRentInr,
    dailyRentInr: fixture.dailyRentInr,
    note: hub.note,
    scooterRanges: {
      x: shortAsset.usableKm,
      y: longAsset.usableKm,
    },
  };
}

export type { EvaluateResult };

export async function createChallenge(payload: {
  longRangeTo: string;
  outage: boolean;
  bookingsSupported: number;
  bookingsTotal: number;
}) {
  try {
    const res = await fetch(`/api/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("challenge failed");
    return (await res.json()) as {
      id: string;
      sharePath: string;
      cardCopy: string;
      bookingsSupported: number;
      bookingsTotal: number;
    };
  } catch {
    const id = `local${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      sharePath: `/challenge?c=${id}`,
      cardCopy: `my handover covered ${payload.bookingsSupported} of ${payload.bookingsTotal} bookings. can yours cover both?`,
      bookingsSupported: payload.bookingsSupported,
      bookingsTotal: payload.bookingsTotal,
    };
  }
}
