/**
 * What the hub manager needs to handle right now.
 * Plain floor language - not product/AI copy.
 */

import type { DriverInsight, FleetPortfolio } from "./fleet-insights";
import type { HubResult } from "./types";

export type AttentionSection =
  | "allocation"
  | "health"
  | "drivers"
  | "residual"
  | "service";

export type AttentionSeverity = "now" | "watch" | "later";

export type AttentionAction =
  | "optimize"
  | "reassign"
  | "workshop"
  | "open"
  | "book_service";

export type AttentionItem = {
  id: string;
  section: AttentionSection;
  severity: AttentionSeverity;
  title: string;
  entity: string;
  impact: string;
  action: AttentionAction;
  actionLabel: string;
  vehicleId?: string;
  riderId?: string;
};

export const SECTION_META: Record<
  AttentionSection,
  {
    label: string;
    tab: "overview" | "allocation" | "health" | "drivers" | "leases" | "service";
  }
> = {
  allocation: { label: "Matches", tab: "allocation" },
  health: { label: "Bikes", tab: "health" },
  drivers: { label: "Riders", tab: "drivers" },
  residual: { label: "Rent book", tab: "leases" },
  service: { label: "Service", tab: "service" },
};

const SECTION_CAP = 2;

export function buildAttentionQueue(
  portfolio: FleetPortfolio,
  hub: HubResult,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (hub.waitingCount > 0) {
    const first = hub.floor.find((f) => f.status === "waiting");
    items.push({
      id: "alloc-waiting",
      section: "allocation",
      severity: "now",
      title:
        hub.waitingCount === 1
          ? "Rider waiting for a bike"
          : `${hub.waitingCount} riders waiting`,
      entity: first?.riderName ?? "Waiting",
      impact:
        hub.freeBikes.length > 0
          ? `${hub.freeBikes.length} free bike${hub.freeBikes.length === 1 ? "" : "s"}`
          : "No free bikes",
      action: "optimize",
      actionLabel: "Match waiting",
      riderId: first?.riderId,
    });
  }

  const shortFit = portfolio.vehicles.filter((v) => v.leaseStatus === "at-risk");
  if (shortFit.length > 0) {
    items.push({
      id: "alloc-at-risk-lease",
      section: "allocation",
      severity: "watch",
      title: "Bike won't cover the day",
      entity: shortFit[0]?.scooterLabel ?? "Unit",
      impact:
        shortFit.length > 1
          ? `${shortFit.length} bikes short on range`
          : "Range too thin for the rider",
      action: "open",
      actionLabel: "Open matches",
      vehicleId: shortFit[0]?.scooterId,
    });
  }

  const atRisk = portfolio.vehicles
    .filter((v) => v.healthBand === "at-risk")
    .sort((a, b) => a.healthScore - b.healthScore);
  for (const v of atRisk.slice(0, SECTION_CAP)) {
    items.push({
      id: `health-${v.scooterId}`,
      section: "health",
      severity: "now",
      title: "Bike in bad shape",
      entity: v.scooterLabel,
      impact: v.assignedRiderName
        ? `${v.assignedRiderName} is hard on it`
        : `Condition ${v.healthScore}`,
      action: "reassign",
      actionLabel: "Change rider",
      vehicleId: v.scooterId,
    });
  }

  const watch = portfolio.vehicles
    .filter((v) => v.healthBand === "watch")
    .sort((a, b) => a.healthScore - b.healthScore);
  for (const v of watch.slice(0, Math.max(0, SECTION_CAP - atRisk.length))) {
    items.push({
      id: `watch-${v.scooterId}`,
      section: "health",
      severity: "watch",
      title: "Watch this bike",
      entity: v.scooterLabel,
      impact: `Condition ${v.healthScore}`,
      action: "workshop",
      actionLabel: "Hold for service",
      vehicleId: v.scooterId,
    });
  }

  const stressedDrivers = portfolio.drivers
    .filter((d) => d.stressOnAsset >= 50)
    .sort((a, b) => b.stressOnAsset - a.stressOnAsset);
  for (const d of stressedDrivers.slice(0, SECTION_CAP)) {
    const vehicle = portfolio.vehicles.find(
      (v) => v.assignedRiderId === d.riderId,
    );
    items.push({
      id: `driver-${d.riderId}`,
      section: "drivers",
      severity: d.stressOnAsset >= 70 ? "now" : "watch",
      title: "Hard on the bike",
      entity: d.riderName,
      impact: d.assignedScooter ?? "No bike",
      action: "reassign",
      actionLabel: "Change bike",
      riderId: d.riderId,
      vehicleId: vehicle?.scooterId,
    });
  }

  const residualHot = portfolio.vehicles
    .filter((v) => v.residualAtRiskInr >= 8000)
    .sort((a, b) => b.residualAtRiskInr - a.residualAtRiskInr);
  for (const v of residualHot.slice(0, SECTION_CAP)) {
    items.push({
      id: `residual-${v.scooterId}`,
      section: "residual",
      severity: v.residualAtRiskInr >= 12000 ? "now" : "watch",
      title: "Value at risk",
      entity: v.scooterLabel,
      impact: `₹${Math.round(v.residualAtRiskInr / 1000)}k`,
      action: "reassign",
      actionLabel: "Change rider",
      vehicleId: v.scooterId,
    });
  }

  const dueSoon = portfolio.vehicles
    .filter((v) => v.service.nextServiceInDays <= 10)
    .sort((a, b) => a.service.nextServiceInDays - b.service.nextServiceInDays);
  for (const v of dueSoon.slice(0, SECTION_CAP)) {
    items.push({
      id: `svc-${v.scooterId}`,
      section: "service",
      severity: v.service.risk === "high" ? "now" : "watch",
      title: "Service due",
      entity: v.scooterLabel,
      impact: `${v.service.nextServiceLabel} · ₹${v.service.expectedNext30Inr.toLocaleString("en-IN")}`,
      action: "book_service",
      actionLabel: "Book bay",
      vehicleId: v.scooterId,
    });
  }

  const issueHeavy = portfolio.vehicles
    .filter((v) => v.service.openIssueCount >= 2)
    .sort((a, b) => b.service.openIssueCount - a.service.openIssueCount);
  for (const v of issueHeavy.slice(
    0,
    Math.max(0, SECTION_CAP - dueSoon.length),
  )) {
    items.push({
      id: `issues-${v.scooterId}`,
      section: "service",
      severity: "watch",
      title: "Open issues",
      entity: v.scooterLabel,
      impact: `${v.service.openIssueCount} · ₹${v.service.currentMonthSpendInr} spent`,
      action: "open",
      actionLabel: "See issues",
      vehicleId: v.scooterId,
    });
  }

  return dedupeAttention(sortAttention(items));
}

function dedupeAttention(items: AttentionItem[]) {
  const seen = new Set<string>();
  const out: AttentionItem[] = [];
  for (const item of items) {
    const key = item.vehicleId
      ? `v:${item.vehicleId}`
      : item.riderId
        ? `r:${item.riderId}`
        : item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 5) break;
  }
  return out;
}

function severityRank(s: AttentionSeverity) {
  return s === "now" ? 0 : s === "watch" ? 1 : 2;
}

function sortAttention(items: AttentionItem[]) {
  const sectionOrder: AttentionSection[] = [
    "allocation",
    "service",
    "health",
    "drivers",
    "residual",
  ];
  return items.slice().sort((a, b) => {
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    return sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section);
  });
}

export function groupBySection(items: AttentionItem[]) {
  const order: AttentionSection[] = [
    "allocation",
    "service",
    "health",
    "drivers",
    "residual",
  ];
  return order
    .map((section) => ({
      section,
      items: items.filter((i) => i.section === section),
    }))
    .filter((g) => g.items.length > 0);
}

export function countBySeverity(items: AttentionItem[]) {
  return {
    now: items.filter((i) => i.severity === "now").length,
    watch: items.filter((i) => i.severity === "watch").length,
    later: items.filter((i) => i.severity === "later").length,
    total: items.length,
  };
}

export function sectionActions(
  section: AttentionSection,
  items: AttentionItem[],
): AttentionItem[] {
  return items.filter((i) => i.section === section).slice(0, SECTION_CAP);
}

export function driverForVehicle(
  portfolio: FleetPortfolio,
  vehicleId?: string,
): DriverInsight | undefined {
  if (!vehicleId) return undefined;
  const v = portfolio.vehicles.find((x) => x.scooterId === vehicleId);
  if (!v?.assignedRiderId) return undefined;
  return portfolio.drivers.find((d) => d.riderId === v.assignedRiderId);
}
