/**
 * Fleet-operator models: vehicle health, driver stress, longevity, service & costs.
 */

import {
  buildRiderIssues,
  buildVehicleIssues,
  forecastService,
  type BehaviourIssue,
  type ServiceForecast,
} from "./maintenance";
import { FIXTURE } from "./fixture";
import {
  evaluateHub,
  packUsableKm,
  riderWear,
  scooterReadiness,
} from "./scoring";
import type { Fixture, Pairing, WearResult } from "./types";

export type HealthBand = "strong" | "watch" | "at-risk";
export type LeaseStatus = "earning" | "idle" | "workshop" | "at-risk";

export type VehicleInsight = {
  scooterId: string;
  scooterLabel: string;
  packId: string;
  packLabel: string;
  packSohPct: number;
  usableKm: number;
  readiness: number;
  healthScore: number;
  healthBand: HealthBand;
  longevityMonths: number;
  baseLifeMonths: number;
  residualValueInr: number;
  residualProtectedInr: number;
  residualAtRiskInr: number;
  monthlyLeaseInr: number;
  leaseStatus: LeaseStatus;
  pairingStress: number;
  assignedRiderId: string | null;
  assignedRiderName: string | null;
  riderWear: number | null;
  riderBand: string | null;
  predictedNote: string;
  issues: BehaviourIssue[];
  service: ServiceForecast;
  kmToService: number;
};

export type DriverInsight = {
  riderId: string;
  riderName: string;
  usualArea: string;
  wear: WearResult;
  patternLabel: string;
  typicalDayKm: number;
  maxSwapGapKm: number;
  assignedScooter: string | null;
  assignedScooterId: string | null;
  stressOnAsset: number;
  supportAction: string;
  issues: BehaviourIssue[];
  issuesRaisedCount: number;
  spendAttributedInr: number;
};

export type FleetPortfolio = {
  vehicles: VehicleInsight[];
  drivers: DriverInsight[];
  avgHealth: number;
  avgLongevityMonths: number;
  residualProtectedInr: number;
  residualAtRiskInr: number;
  monthlyLeaseBookInr: number;
  earningUnits: number;
  atRiskUnits: number;
  workshopAvoidedInr: number;
  matchingQualityPct: number;
  thesis: string;
  /** Service spend already logged this month */
  serviceSpendThisMonthInr: number;
  /** Expected service spend next 30 days if behaviour continues */
  serviceExpectedNext30Inr: number;
  openIssueCount: number;
  bikesDueSoon: number;
};

function clip(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function healthBand(score: number): HealthBand {
  if (score >= 80) return "strong";
  if (score >= 65) return "watch";
  return "at-risk";
}

export function pairingStress(
  wear: WearResult | null,
  readiness: number,
  soh: number,
): number {
  if (!wear) return 20;
  const wearLoad = wear.learning ? 35 : wear.score;
  const assetFragility = 100 - (0.5 * readiness + 0.5 * soh);
  return Math.round(clip(0.55 * wearLoad + 0.45 * assetFragility, 0, 100));
}

export function buildFleetPortfolio(
  fixture: Fixture = FIXTURE,
  criticalLongTo?: string,
  outage = false,
): FleetPortfolio {
  const longTo = criticalLongTo ?? fixture.criticalRiderIds[1];
  const hub = evaluateHub(fixture, longTo, outage);
  const byRider = Object.fromEntries(hub.pairings.map((p) => [p.riderId, p]));
  const packs = Object.fromEntries(fixture.packs.map((p) => [p.id, p]));
  const ridersById = Object.fromEntries(fixture.riders.map((r) => [r.id, r]));

  const vehicles: VehicleInsight[] = fixture.scooters.map((scooter, idx) => {
    const pack = packs[scooter.packId];
    const readiness = scooterReadiness(scooter);
    const usableKm = packUsableKm(pack, scooter, fixture.reserveSocPct);
    const pairing = hub.pairings.find((p) => p.scooterId === scooter.id) as
      | Pairing
      | undefined;
    const wear = pairing ? pairing.wear : null;
    const stress = pairingStress(wear, readiness, pack.testedSohPct);
    const healthScore = Math.round(
      clip(
        0.4 * readiness + 0.4 * pack.testedSohPct + 0.2 * (100 - stress),
        0,
        100,
      ),
    );
    const baseLifeMonths = 36;
    const longevityMonths = Math.round(
      clip(
        baseLifeMonths * (healthScore / 100) * (1 - stress / 220),
        8,
        baseLifeMonths,
      ),
    );
    const residualValueInr =
      28000 + idx * 1500 + Math.round(pack.testedSohPct * 80);
    const lifeRatio = longevityMonths / baseLifeMonths;
    const residualProtectedInr = Math.round(residualValueInr * lifeRatio);
    const residualAtRiskInr = Math.max(
      0,
      residualValueInr - residualProtectedInr,
    );
    const monthlyLeaseInr = fixture.dailyRentInr * 26;

    let leaseStatus: LeaseStatus = "earning";
    if (!scooter.dispatchClear || !pack.dispatchClear) leaseStatus = "workshop";
    else if (!pairing?.fit.supportsBooking) leaseStatus = "at-risk";
    else if (healthScore < 65) leaseStatus = "at-risk";
    else if (!pairing) leaseStatus = "idle";

    const rider = pairing ? ridersById[pairing.riderId] : null;
    const issues = buildVehicleIssues(scooter, pack, rider ?? null, wear, stress);
    const service = forecastService(
      scooter,
      pack,
      issues,
      stress,
      rider?.dailyKm ?? 55,
    );

    const predictedNote =
      service.risk === "high"
        ? `Next bay visit ${service.nextServiceLabel.toLowerCase()} — ${service.reason.toLowerCase()}.`
        : stress >= 55
          ? "This rider is hard on the bike — expect more pad / pack wear."
          : healthScore >= 80
            ? "Condition looks fine for the current match."
            : "Keep an eye on service window and pack.";

    return {
      scooterId: scooter.id,
      scooterLabel: scooter.label,
      packId: pack.id,
      packLabel: pack.label,
      packSohPct: pack.testedSohPct,
      usableKm,
      readiness,
      healthScore,
      healthBand: healthBand(healthScore),
      longevityMonths,
      baseLifeMonths,
      residualValueInr,
      residualProtectedInr,
      residualAtRiskInr,
      monthlyLeaseInr,
      leaseStatus,
      pairingStress: stress,
      assignedRiderId: pairing?.riderId ?? null,
      assignedRiderName: pairing?.riderName ?? null,
      riderWear: wear?.score ?? null,
      riderBand: wear?.band ?? null,
      predictedNote,
      issues,
      service,
      kmToService: scooter.kmToService,
    };
  });

  const drivers: DriverInsight[] = fixture.riders.map((rider) => {
    const wear = riderWear(rider);
    const pairing = byRider[rider.id];
    const stressOnAsset = pairing
      ? pairingStress(
          wear,
          pairing.readiness,
          packs[pairing.packId].testedSohPct,
        )
      : wear.score;
    const issues = buildRiderIssues(
      rider,
      wear,
      pairing?.scooterId ?? null,
    );
    return {
      riderId: rider.id,
      riderName: rider.name,
      usualArea: rider.usualArea,
      wear,
      patternLabel: pairing?.pattern.label ?? "Unassigned",
      typicalDayKm: rider.dailyKm,
      maxSwapGapKm: rider.longestLegKm,
      assignedScooter: pairing?.scooterLabel ?? null,
      assignedScooterId: pairing?.scooterId ?? null,
      stressOnAsset,
      supportAction: pairing?.handoverAction ?? "awaiting allocation",
      issues,
      issuesRaisedCount: issues.length,
      spendAttributedInr: issues.reduce((s, i) => s + i.costInr, 0),
    };
  });

  const avgHealth = Math.round(
    vehicles.reduce((s, v) => s + v.healthScore, 0) / vehicles.length,
  );
  const avgLongevityMonths = Math.round(
    vehicles.reduce((s, v) => s + v.longevityMonths, 0) / vehicles.length,
  );
  const residualProtectedInr = vehicles.reduce(
    (s, v) => s + v.residualProtectedInr,
    0,
  );
  const residualAtRiskInr = vehicles.reduce(
    (s, v) => s + v.residualAtRiskInr,
    0,
  );
  const monthlyLeaseBookInr = vehicles
    .filter((v) => v.leaseStatus === "earning")
    .reduce((s, v) => s + v.monthlyLeaseInr, 0);
  const earningUnits = vehicles.filter((v) => v.leaseStatus === "earning").length;
  const atRiskUnits = vehicles.filter((v) => v.leaseStatus === "at-risk").length;
  const matchingQualityPct = Math.round(
    (hub.bookingsSupported / hub.bookingsTotal) * 100,
  );
  const workshopAvoidedInr =
    vehicles.filter((v) => v.healthBand === "strong").length * 1200 +
    Math.max(0, hub.bookingsSupported - 1) * 800;

  const serviceSpendThisMonthInr = vehicles.reduce(
    (s, v) => s + v.service.currentMonthSpendInr,
    0,
  );
  const serviceExpectedNext30Inr = vehicles.reduce(
    (s, v) => s + v.service.expectedNext30Inr,
    0,
  );
  const openIssueCount = vehicles.reduce(
    (s, v) => s + v.service.openIssueCount,
    0,
  );
  const bikesDueSoon = vehicles.filter(
    (v) => v.service.nextServiceInDays <= 10,
  ).length;

  return {
    vehicles,
    drivers,
    avgHealth,
    avgLongevityMonths,
    residualProtectedInr,
    residualAtRiskInr,
    monthlyLeaseBookInr,
    earningUnits,
    atRiskUnits,
    workshopAvoidedInr,
    matchingQualityPct,
    thesis:
      "Match the right rider to the bike so service stays predictable and resale value holds.",
    serviceSpendThisMonthInr,
    serviceExpectedNext30Inr,
    openIssueCount,
    bikesDueSoon,
  };
}
