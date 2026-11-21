import { FIXTURE } from "./fixture";
import type {
  EvaluateResult,
  FitResult,
  Fixture,
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
      "Few tracked shifts — treat swap-gap as provisional until peer coverage builds.";
  } else if (gap >= day * 0.85) {
    label = "Long single-pack stretch";
    detail =
      "Behaviour shows long gaps between dependable swaps. Needs range that can finish the stretch.";
  } else if (gap <= 30 && day >= 80) {
    label = "Dense swap habit";
    detail =
      "High daily km but short observed gaps between swaps — can clear on a mid-range pack.";
  } else if (wear.band === "elevated") {
    label = "Hard usage pattern";
    detail =
      "Elevated damage / high-load density from tracked riding. Pair with a ready unit and tighter handover.";
  } else {
    label = "Steady delivery pattern";
    detail =
      "Stable tracked distance and swap gaps. Standard match against pack range is enough.";
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

function buildPairing(
  rider: Rider,
  asset: Asset,
  criticalIds: string[],
): Pairing {
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
    isCritical: criticalIds.includes(rider.id),
  };
}

/** Greedy: longest leg first → longest remaining pack that fits (else best available). */
function matchRidersToAssets(
  riders: Rider[],
  assets: Asset[],
): Map<string, Asset> {
  const sortedRiders = [...riders].sort(
    (a, b) => b.longestLegKm - a.longestLegKm,
  );
  const pool = [...assets].sort((a, b) => b.usableKm - a.usableKm);
  const assignment = new Map<string, Asset>();

  for (const rider of sortedRiders) {
    const fitIdx = pool.findIndex((a) => a.usableKm >= rider.longestLegKm);
    const idx = fitIdx >= 0 ? fitIdx : 0;
    assignment.set(rider.id, pool[idx]);
    pool.splice(idx, 1);
  }
  return assignment;
}

/**
 * Evaluate a full hub morning board.
 * `criticalLongTo` decides who receives the longest-range scooter in the critical pair.
 * Remaining riders are auto-matched to remaining assets.
 */
export function evaluateHub(
  fixture: Fixture = FIXTURE,
  criticalLongTo: string,
  outage = false,
): HubResult {
  const [critA, critB] = fixture.criticalRiderIds;
  const riders: Rider[] = fixture.riders.map((r) => {
    if (outage && r.id === fixture.outage.riderId) {
      return { ...r, longestLegKm: fixture.outage.longestLegKm };
    }
    return { ...r };
  });

  const assets = buildAssets(fixture);
  const byScooter = Object.fromEntries(assets.map((a) => [a.scooter.id, a]));
  const sortedByRange = [...assets].sort((a, b) => b.usableKm - a.usableKm);
  const longAsset = sortedByRange[0];
  const shortAsset = sortedByRange[sortedByRange.length - 1];

  // Critical pair always uses the longest and shortest packs (demo conflict).
  const criticalAssignment = new Map<string, Asset>();
  if (criticalLongTo === critA) {
    criticalAssignment.set(critA, longAsset);
    criticalAssignment.set(critB, shortAsset);
  } else {
    criticalAssignment.set(critB, longAsset);
    criticalAssignment.set(critA, shortAsset);
  }

  const remainingRiders = riders.filter(
    (r) => r.id !== critA && r.id !== critB,
  );
  const usedIds = new Set(
    [...criticalAssignment.values()].map((a) => a.scooter.id),
  );
  const remainingAssets = assets.filter((a) => !usedIds.has(a.scooter.id));
  const rest = matchRidersToAssets(remainingRiders, remainingAssets);

  const assignment = new Map<string, Asset>([
    ...criticalAssignment,
    ...rest,
  ]);

  const pairings = riders.map((rider) =>
    buildPairing(rider, assignment.get(rider.id)!, fixture.criticalRiderIds),
  );

  const supported = pairings.filter((p) => p.fit.supportsBooking).length;
  const techHandovers = pairings.filter(
    (p) =>
      p.fit.supportsBooking &&
      (p.handoverAction === "technician handover" ||
        p.handoverAction === "assisted first handover" ||
        p.handoverAction === "documented handover" ||
        p.handoverAction === "earlier follow-up check"),
  ).length;

  let note: string | null = null;
  if (outage && supported < pairings.length) {
    note =
      "one booking needs another compatible pack or a different swap point.";
  } else if (supported < pairings.length) {
    const short = pairings.find((p) => !p.fit.supportsBooking);
    note = short
      ? `${short.riderName} cannot cover their next stretch on the assigned pack — reassign before dispatch.`
      : null;
  }

  return {
    hubName: fixture.hubName,
    shiftLabel: fixture.shiftLabel,
    outage,
    scaleMaxKm: 70,
    pairings,
    bookingsSupported: supported,
    bookingsTotal: pairings.length,
    grossRentInr: supported * fixture.dailyRentInr,
    dailyRentInr: fixture.dailyRentInr,
    techHandovers,
    rentAtRiskInr: (pairings.length - supported) * fixture.dailyRentInr,
    note,
    critical: {
      riderIds: fixture.criticalRiderIds,
      longRangeScooterId: longAsset.scooter.id,
      longRangeKm: longAsset.usableKm,
      shortRangeKm: shortAsset.usableKm,
    },
  };
}

export function recommendedCriticalLongTo(
  fixture: Fixture = FIXTURE,
): string {
  // Prefer the assignment that maximises bookings (then rent).
  const [a, b] = fixture.criticalRiderIds;
  const optA = evaluateHub(fixture, a, false);
  const optB = evaluateHub(fixture, b, false);
  if (optB.bookingsSupported !== optA.bookingsSupported) {
    return optB.bookingsSupported > optA.bookingsSupported ? b : a;
  }
  return optB.grossRentInr >= optA.grossRentInr ? b : a;
}

/** Legacy 2-rider evaluator kept for challenge share + acceptance. */
export function evaluateAssignment(
  fixture: Fixture = FIXTURE,
  longRangeTo: "asha" | "ravi",
  outage = false,
): EvaluateResult {
  const hub = evaluateHub(fixture, longRangeTo, outage);
  const critical = hub.pairings.filter((p) => p.isCritical);
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
      x: hub.critical.shortRangeKm,
      y: hub.critical.longRangeKm,
    },
  };
}

// Re-export for older imports
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
