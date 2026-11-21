/**
 * Service forecast + past issues from rider/vehicle behaviour.
 * Demo model for hub managers — plain costs and dates, not ML jargon.
 */

import type { Rider, Scooter, Pack } from "./types";
import type { WearResult } from "./types";

export type IssueKind =
  | "scrape"
  | "brake"
  | "pack_fade"
  | "hard_ride"
  | "missed_service"
  | "range_complaint"
  | "inspection";

export type IssueStatus = "open" | "booked" | "fixed" | "skipped";

export type IssueAction = "book_service" | "change_rider" | "mark_fixed" | "call_rider";

export type BehaviourIssue = {
  id: string;
  kind: IssueKind;
  title: string;
  detail: string;
  raisedOn: string; // ISO date
  source: "bike" | "rider" | "hub";
  costInr: number;
  expectedCostInr: number;
  status: IssueStatus;
  action: IssueAction;
  actionLabel: string;
  scooterId?: string;
  riderId?: string;
};

export type ServiceForecast = {
  nextServiceInDays: number;
  nextServiceLabel: string;
  risk: "low" | "medium" | "high";
  reason: string;
  predictedJobs: string[];
  currentMonthSpendInr: number;
  expectedNext30Inr: number;
  openIssueCount: number;
};

const KIND_LABEL: Record<IssueKind, string> = {
  scrape: "Body scrape",
  brake: "Brake pull",
  pack_fade: "Pack fading",
  hard_ride: "Hard riding",
  missed_service: "Service overdue",
  range_complaint: "Range short",
  inspection: "Failed check",
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function buildVehicleIssues(
  scooter: Scooter,
  pack: Pack,
  rider: Rider | null,
  wear: WearResult | null,
  stress: number,
): BehaviourIssue[] {
  const issues: BehaviourIssue[] = [];
  const seed = hashSeed(scooter.id);

  // Service proximity from km to service
  const servicePct = scooter.kmToService / scooter.serviceIntervalKm;
  if (servicePct < 0.35) {
    issues.push({
      id: `${scooter.id}-svc`,
      kind: "missed_service",
      title: servicePct < 0.2 ? "Service due soon" : "Service coming up",
      detail: `${scooter.kmToService} km left on interval`,
      raisedOn: daysAgo(2 + (seed % 5)),
      source: "bike",
      costInr: 0,
      expectedCostInr: 1800 + (seed % 4) * 200,
      status: "open",
      action: "book_service",
      actionLabel: "Book service",
      scooterId: scooter.id,
      riderId: rider?.id,
    });
  }

  if (pack.testedSohPct < 85) {
    issues.push({
      id: `${scooter.id}-pack`,
      kind: "pack_fade",
      title: "Pack fading",
      detail: `SOH ${pack.testedSohPct}% — riders may feel short range`,
      raisedOn: daysAgo(8 + (seed % 6)),
      source: "bike",
      costInr: 600 + (seed % 3) * 150,
      expectedCostInr: 2500,
      status: "open",
      action: "book_service",
      actionLabel: "Book pack check",
      scooterId: scooter.id,
      riderId: rider?.id,
    });
  }

  if (scooter.inspectionPassPct < 93) {
    issues.push({
      id: `${scooter.id}-insp`,
      kind: "inspection",
      title: "Failed morning check",
      detail: `Pass rate ${scooter.inspectionPassPct}% last 30 days`,
      raisedOn: daysAgo(1 + (seed % 4)),
      source: "hub",
      costInr: 350,
      expectedCostInr: 900,
      status: "open",
      action: "book_service",
      actionLabel: "Hold for bay",
      scooterId: scooter.id,
    });
  }

  if (scooter.whPerKm >= 37) {
    issues.push({
      id: `${scooter.id}-eff`,
      kind: "range_complaint",
      title: "Using more juice than peers",
      detail: `${scooter.whPerKm} Wh/km vs hub ~36`,
      raisedOn: daysAgo(5 + (seed % 7)),
      source: "bike",
      costInr: 0,
      expectedCostInr: 700,
      status: "open",
      action: "book_service",
      actionLabel: "Check drivetrain",
      scooterId: scooter.id,
      riderId: rider?.id,
    });
  }

  if (rider && (rider.damageIncidents > 0 || (wear && wear.score >= 60))) {
    issues.push({
      id: `${scooter.id}-scrape`,
      kind: "scrape",
      title: "Body damage noted",
      detail: `${rider.name}: ${rider.damageIncidents} scrape/damage flags`,
      raisedOn: daysAgo(3 + (seed % 8)),
      source: "rider",
      costInr: 400 + rider.damageIncidents * 250,
      expectedCostInr: 1200,
      status: "open",
      action: "change_rider",
      actionLabel: "Change rider",
      scooterId: scooter.id,
      riderId: rider.id,
    });
  }

  if (stress >= 50 || (rider && rider.highLoadEpisodes >= 15)) {
    issues.push({
      id: `${scooter.id}-hard`,
      kind: "hard_ride",
      title: "Hard on brakes / load",
      detail: rider
        ? `${rider.name}: ${rider.highLoadEpisodes} heavy-load days`
        : `Load score ${stress}`,
      raisedOn: daysAgo(4 + (seed % 5)),
      source: "rider",
      costInr: 500,
      expectedCostInr: 1400,
      status: "open",
      action: rider ? "call_rider" : "book_service",
      actionLabel: rider ? "Talk to rider" : "Book service",
      scooterId: scooter.id,
      riderId: rider?.id,
    });
  }

  // Cap so cards stay readable
  return issues.slice(0, 4);
}

export function buildRiderIssues(
  rider: Rider,
  wear: WearResult,
  assignedScooterId: string | null,
): BehaviourIssue[] {
  const issues: BehaviourIssue[] = [];
  const seed = hashSeed(rider.id);

  if (rider.damageIncidents > 0) {
    issues.push({
      id: `${rider.id}-dmg`,
      kind: "scrape",
      title: "Damage reports on shifts",
      detail: `${rider.damageIncidents} incident${rider.damageIncidents === 1 ? "" : "s"} in tracked history`,
      raisedOn: daysAgo(6 + (seed % 5)),
      source: "rider",
      costInr: rider.damageIncidents * 350,
      expectedCostInr: rider.damageIncidents * 500,
      status: "open",
      action: "call_rider",
      actionLabel: "Talk to rider",
      riderId: rider.id,
      scooterId: assignedScooterId ?? undefined,
    });
  }

  if (rider.highLoadEpisodes >= 12) {
    issues.push({
      id: `${rider.id}-load`,
      kind: "hard_ride",
      title: "Heavy load days",
      detail: `${rider.highLoadEpisodes} high-load episodes — wears pads faster`,
      raisedOn: daysAgo(2 + (seed % 6)),
      source: "rider",
      costInr: 0,
      expectedCostInr: 900,
      status: "open",
      action: "change_rider",
      actionLabel: "Give tougher bike",
      riderId: rider.id,
      scooterId: assignedScooterId ?? undefined,
    });
  }

  if (wear.band === "elevated" || wear.band === "review") {
    issues.push({
      id: `${rider.id}-wear`,
      kind: "brake",
      title: "Wear pattern needs review",
      detail: `Wear band: ${wear.band}`,
      raisedOn: daysAgo(1 + (seed % 3)),
      source: "hub",
      costInr: 200,
      expectedCostInr: 1100,
      status: "open",
      action: "change_rider",
      actionLabel: "Move off fragile bike",
      riderId: rider.id,
      scooterId: assignedScooterId ?? undefined,
    });
  }

  if (!rider.peerDataReady) {
    issues.push({
      id: `${rider.id}-new`,
      kind: "range_complaint",
      title: "Thin history — watch first weeks",
      detail: `Only ${rider.trackedShifts} shifts tracked`,
      raisedOn: daysAgo(0),
      source: "hub",
      costInr: 0,
      expectedCostInr: 400,
      status: "open",
      action: "call_rider",
      actionLabel: "Brief rider",
      riderId: rider.id,
      scooterId: assignedScooterId ?? undefined,
    });
  }

  return issues.slice(0, 4);
}

export function forecastService(
  scooter: Scooter,
  pack: Pack,
  issues: BehaviourIssue[],
  stress: number,
  dailyKm: number,
): ServiceForecast {
  const kmPerDay = Math.max(30, dailyKm || 55);
  const daysByKm = Math.round(scooter.kmToService / kmPerDay);
  // Stress + open issues pull service forward
  const pullIn = Math.round(stress / 25) + issues.filter((i) => i.status === "open").length * 2;
  const nextServiceInDays = Math.max(1, daysByKm - pullIn);

  let risk: ServiceForecast["risk"] = "low";
  if (nextServiceInDays <= 7 || pack.testedSohPct < 82) risk = "high";
  else if (nextServiceInDays <= 18 || stress >= 45) risk = "medium";

  const predictedJobs: string[] = [];
  if (scooter.kmToService < 1000) predictedJobs.push("Interval service");
  if (pack.testedSohPct < 85) predictedJobs.push("Pack health check");
  if (stress >= 50) predictedJobs.push("Brake / pad check");
  if (scooter.whPerKm >= 37) predictedJobs.push("Drivetrain look");
  if (predictedJobs.length === 0) predictedJobs.push("Routine check");

  const open = issues.filter((i) => i.status === "open");
  const currentMonthSpendInr = issues.reduce((s, i) => s + i.costInr, 0);
  const expectedNext30Inr =
    open.reduce((s, i) => s + i.expectedCostInr, 0) +
    (risk === "high" ? 1800 : risk === "medium" ? 900 : 300);

  const nextServiceLabel =
    nextServiceInDays <= 1
      ? "Tomorrow"
      : nextServiceInDays <= 7
        ? `In ${nextServiceInDays} days`
        : `In ~${nextServiceInDays} days`;

  const reason =
    risk === "high"
      ? "Past behaviour + km left say this will need the bay soon"
      : risk === "medium"
        ? "Usage pattern is pulling service forward"
        : "On track for normal interval";

  return {
    nextServiceInDays,
    nextServiceLabel,
    risk,
    reason,
    predictedJobs,
    currentMonthSpendInr,
    expectedNext30Inr,
    openIssueCount: open.length,
  };
}

export function issueKindLabel(kind: IssueKind) {
  return KIND_LABEL[kind];
}
