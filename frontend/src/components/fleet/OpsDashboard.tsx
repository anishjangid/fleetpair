"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bike,
  ClipboardList,
  IndianRupee,
  Map,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { buildAttentionQueue, type AttentionItem } from "@/lib/attention";
import { FIXTURE } from "@/lib/fixture";
import { buildFleetPortfolio, type VehicleInsight } from "@/lib/fleet-insights";
import {
  issueKindLabel,
  type BehaviourIssue,
  type IssueStatus,
} from "@/lib/maintenance";
import type { OpsTab } from "@/lib/ops-ai";
import { autoAssignWaiting, evaluateHub } from "@/lib/scoring";
import type { AssignmentMap } from "@/lib/types";
import { TodoList } from "@/components/fleet/TodoList";
import { FleetMap } from "@/components/fleet/FleetMap";
import { AiOpsCopilot } from "@/components/fleet/AiOpsCopilot";
import { DispatchBoard } from "@/components/hub/DispatchBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV: { id: OpsTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "overview", label: "Home", icon: ClipboardList },
  { id: "map", label: "Map", icon: Map },
  { id: "allocation", label: "Matches", icon: ArrowLeftRight },
  { id: "service", label: "Service", icon: Wrench },
  { id: "health", label: "Bikes", icon: Bike },
  { id: "drivers", label: "Riders", icon: Users },
  { id: "leases", label: "Rent", icon: IndianRupee },
];

export function OpsDashboard() {
  const [tab, setTab] = useState<OpsTab>("overview");
  const [assignments, setAssignments] = useState<AssignmentMap>(
    () => ({ ...FIXTURE.initialAssignments }),
  );
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [issueStatus, setIssueStatus] = useState<Record<string, IssueStatus>>(
    {},
  );

  const hub = useMemo(
    () => evaluateHub(FIXTURE, assignments, false),
    [assignments],
  );

  const portfolio = useMemo(
    () => buildFleetPortfolio(FIXTURE, assignments, false),
    [assignments],
  );

  const attention = useMemo(
    () => buildAttentionQueue(portfolio, hub),
    [portfolio, hub],
  );

  const brief = useMemo(
    () => ({
      avgHealth: portfolio.avgHealth,
      atRiskUnits: portfolio.atRiskUnits,
      residualAtRiskInr: portfolio.residualAtRiskInr,
      matchingQualityPct: portfolio.matchingQualityPct,
      earningUnits: portfolio.earningUnits,
      waitingCount: hub.waitingCount,
    }),
    [portfolio, hub],
  );

  const todoLeft = attention.filter((i) => !dismissed.has(i.id)).length;

  function statusOf(issue: BehaviourIssue): IssueStatus {
    return issueStatus[issue.id] ?? issue.status;
  }

  function patchIssue(id: string, status: IssueStatus, msg: string) {
    setIssueStatus((p) => ({ ...p, [id]: status }));
    toast.success(msg);
  }

  function onIssue(issue: BehaviourIssue) {
    switch (issue.action) {
      case "book_service":
        patchIssue(issue.id, "booked", "Booked for the bay");
        if (issue.scooterId) setSelectedVehicle(issue.scooterId);
        setTab("service");
        break;
      case "change_rider":
        patchIssue(issue.id, "booked", "Open the bike to change rider");
        if (issue.scooterId) {
          setSelectedVehicle(issue.scooterId);
          setTab("health");
        } else if (issue.riderId) {
          setSelectedRider(issue.riderId);
          setTab("drivers");
        }
        break;
      case "mark_fixed":
        patchIssue(issue.id, "fixed", "Marked fixed");
        break;
      case "call_rider":
        patchIssue(issue.id, "booked", "Follow up with rider");
        if (issue.riderId) setSelectedRider(issue.riderId);
        setTab("drivers");
        break;
    }
  }

  function optimizeMatch() {
    setAssignments((prev) => autoAssignWaiting(FIXTURE, prev));
    toast.success("Waiting riders matched");
  }

  function bookBay(v?: VehicleInsight) {
    const target =
      v ??
      portfolio.vehicles
        .slice()
        .sort(
          (a, b) => a.service.nextServiceInDays - b.service.nextServiceInDays,
        )[0];
    if (target?.issues[0]) {
      patchIssue(
        target.issues[0].id,
        "booked",
        `Bay booked · ${target.scooterLabel}`,
      );
    } else {
      toast.success(`Bay booked · ${target.scooterLabel}`);
    }
    setTab("service");
    if (target) setSelectedVehicle(target.scooterId);
  }

  function changeRider(v?: VehicleInsight) {
    const target =
      v ??
      portfolio.vehicles
        .slice()
        .sort((a, b) => b.pairingStress - a.pairingStress)[0];
    setTab("health");
    if (target) setSelectedVehicle(target.scooterId);
    toast.message("Change rider", { description: target.scooterLabel });
  }

  function onTodo(item: AttentionItem) {
    const vehicle = item.vehicleId
      ? portfolio.vehicles.find((x) => x.scooterId === item.vehicleId)
      : undefined;
    switch (item.action) {
      case "optimize":
        optimizeMatch();
        setTab("allocation");
        break;
      case "reassign":
        changeRider(vehicle);
        break;
      case "workshop":
      case "book_service":
        bookBay(vehicle);
        break;
      case "open":
        setTab(
          item.section === "allocation"
            ? "allocation"
            : item.section === "drivers"
              ? "drivers"
              : item.section === "residual"
                ? "leases"
                : item.section === "service"
                  ? "service"
                  : "health",
        );
        if (item.vehicleId) setSelectedVehicle(item.vehicleId);
        break;
    }
    setDismissed((p) => new Set(p).add(item.id));
  }

  const selected =
    portfolio.vehicles.find((v) => v.scooterId === selectedVehicle) ?? null;
  const selectedDriver =
    portfolio.drivers.find((d) => d.riderId === selectedRider) ?? null;

  const pageTitle =
    tab === "overview"
      ? "Live floor"
      : (NAV.find((n) => n.id === tab)?.label ?? "Live floor");

  return (
    <div className="pb-2 lg:pb-0">
      <div className="lg:grid lg:grid-cols-[188px_minmax(0,1fr)] lg:gap-8">
        {/* Desktop side nav */}
        <aside className="surface mb-4 hidden p-3 lg:mb-0 lg:block lg:self-start lg:sticky lg:top-20">
          <p className="px-2 text-base font-bold tracking-[-0.03em]">
            {FIXTURE.hubName}
          </p>
          <p className="mt-0.5 px-2 text-xs text-muted-foreground">
            {FIXTURE.shiftLabel}
          </p>
          <nav className="mt-4 flex flex-col gap-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              const badge =
                item.id === "overview"
                  ? todoLeft
                  : item.id === "service"
                    ? portfolio.bikesDueSoon
                    : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                  {badge > 0 && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-1.5 text-[10px] font-bold tabular",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-5 sm:space-y-6">
          <header className="surface px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-muted-foreground lg:hidden">
              {FIXTURE.hubName} · {FIXTURE.shiftLabel}
            </p>
            <h1 className="text-xl font-bold tracking-[-0.03em] sm:text-2xl">
              {pageTitle}
            </h1>
          </header>

          {tab === "overview" && (
            <section className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Kpi
                  label="Covered"
                  value={`${portfolio.matchingQualityPct}%`}
                />
                <Kpi
                  label="Service 30d"
                  value={`₹${Math.round(portfolio.serviceExpectedNext30Inr / 1000)}k`}
                />
                <Kpi label="To do" value={`${todoLeft}`} />
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Do these first</h2>
                <TodoList
                  items={attention}
                  dismissed={dismissed}
                  onAct={onTodo}
                  onSkip={(id) =>
                    setDismissed((p) => new Set(p).add(id))
                  }
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <JumpCard
                  title="Map"
                  blurb="Where bikes are working"
                  onClick={() => setTab("map")}
                />
                <JumpCard
                  title="Matches"
                  blurb="Who gets which bike"
                  onClick={() => setTab("allocation")}
                />
                <JumpCard
                  title="Service"
                  blurb={`${portfolio.bikesDueSoon} due soon`}
                  onClick={() => setTab("service")}
                />
                <JumpCard
                  title="Bikes"
                  blurb={`${portfolio.openIssueCount} open issues`}
                  onClick={() => setTab("health")}
                />
              </div>
            </section>
          )}

          {tab === "map" && (
            <FleetMap
              vehicles={portfolio.vehicles}
              drivers={portfolio.drivers}
              onOpenBike={(id) => {
                setSelectedVehicle(id);
              }}
            />
          )}

          {tab === "allocation" && (
            <DispatchBoard
              assignments={assignments}
              onAssignmentsChange={setAssignments}
            />
          )}

          {tab === "service" && (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <Kpi
                  label="Spent"
                  value={`₹${Math.round(portfolio.serviceSpendThisMonthInr / 1000)}k`}
                />
                <Kpi
                  label="Next 30d"
                  value={`₹${Math.round(portfolio.serviceExpectedNext30Inr / 1000)}k`}
                />
                <Kpi label="Due soon" value={`${portfolio.bikesDueSoon}`} />
                <Kpi
                  label="Open issues"
                  value={`${portfolio.openIssueCount}`}
                />
              </div>

              <div className="surface space-y-3 px-3 py-3 sm:px-4">
                <p className="text-sm font-semibold">Cost mix · this month</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <CostBucket
                    label="Parts"
                    value={portfolio.serviceSpentSplit.partsInr}
                    hint="Pads, panels, harness"
                  />
                  <CostBucket
                    label="Labour"
                    value={portfolio.serviceSpentSplit.labourInr}
                    hint="Bay time"
                  />
                  <CostBucket
                    label="Consumables"
                    value={portfolio.serviceSpentSplit.consumablesInr}
                    hint="Fluids, fasteners"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Next 30d expected · parts ₹
                  {portfolio.serviceExpectedSplit.partsInr.toLocaleString(
                    "en-IN",
                  )}{" "}
                  · labour ₹
                  {portfolio.serviceExpectedSplit.labourInr.toLocaleString(
                    "en-IN",
                  )}{" "}
                  · consumables ₹
                  {portfolio.serviceExpectedSplit.consumablesInr.toLocaleString(
                    "en-IN",
                  )}
                </p>
              </div>

              <div className="surface overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium sm:px-4">Bike</th>
                      <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                        Next service
                      </th>
                      <th className="px-3 py-2.5 font-medium sm:px-4">Parts</th>
                      <th className="px-3 py-2.5 font-medium sm:px-4">
                        Labour
                      </th>
                      <th className="px-3 py-2.5 font-medium sm:px-4">
                        Next ₹
                      </th>
                      <th className="px-3 py-2.5 font-medium sm:px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.vehicles
                      .slice()
                      .sort(
                        (a, b) =>
                          a.service.nextServiceInDays -
                          b.service.nextServiceInDays,
                      )
                      .map((v) => (
                        <tr
                          key={v.scooterId}
                          className="border-b border-border/70 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium">{v.scooterLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {v.assignedRiderName ?? "Free"} ·{" "}
                              {v.service.openIssueCount} issues
                            </p>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                            {v.service.nextServiceLabel}
                          </td>
                          <td className="px-4 py-3 tabular">
                            ₹
                            {v.service.expectedSplit.partsInr.toLocaleString(
                              "en-IN",
                            )}
                          </td>
                          <td className="px-4 py-3 tabular">
                            ₹
                            {v.service.expectedSplit.labourInr.toLocaleString(
                              "en-IN",
                            )}
                          </td>
                          <td className="px-4 py-3 tabular">
                            ₹
                            {v.service.expectedNext30Inr.toLocaleString(
                              "en-IN",
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => setSelectedVehicle(v.scooterId)}
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "health" && (
            <section className="surface overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Bike</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Rider</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Condition</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                      Service
                    </th>
                    <th className="px-3 py-2.5 font-medium sm:px-4" />
                  </tr>
                </thead>
                <tbody>
                  {portfolio.vehicles
                    .slice()
                    .sort((a, b) => a.healthScore - b.healthScore)
                    .map((v) => (
                      <tr
                        key={v.scooterId}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {v.scooterLabel}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.assignedRiderName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "tabular",
                              v.healthScore < 65 && "text-destructive",
                              v.healthScore >= 65 &&
                                v.healthScore < 80 &&
                                "text-[var(--warn)]",
                            )}
                          >
                            {v.healthScore}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {v.service.nextServiceLabel}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelectedVehicle(v.scooterId)}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "drivers" && (
            <section className="surface overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Rider</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Bike</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Issues</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                      Day km
                    </th>
                    <th className="px-3 py-2.5 font-medium sm:px-4" />
                  </tr>
                </thead>
                <tbody>
                  {portfolio.drivers
                    .slice()
                    .sort((a, b) => b.issuesRaisedCount - a.issuesRaisedCount)
                    .map((d) => (
                      <tr
                        key={d.riderId}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{d.riderName}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.usualArea}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {d.assignedScooter ?? "—"}
                        </td>
                        <td className="px-4 py-3 tabular">
                          {d.issuesRaisedCount}
                        </td>
                        <td className="hidden px-4 py-3 tabular text-muted-foreground sm:table-cell">
                          {d.typicalDayKm}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelectedRider(d.riderId)}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "leases" && (
            <section className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Kpi
                  label="Rent"
                  value={`₹${Math.round(portfolio.monthlyLeaseBookInr / 1000)}k`}
                />
                <Kpi
                  label="Held"
                  value={`₹${Math.round(portfolio.residualProtectedInr / 1000)}k`}
                />
                <Kpi
                  label="At risk"
                  value={`₹${Math.round(portfolio.residualAtRiskInr / 1000)}k`}
                />
              </div>
              <div className="surface overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium sm:px-4">Bike</th>
                      <th className="px-3 py-2.5 font-medium sm:px-4">Rider</th>
                      <th className="px-3 py-2.5 font-medium sm:px-4">Status</th>
                      <th className="px-3 py-2.5 font-medium sm:px-4">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.vehicles.map((v) => (
                      <tr
                        key={v.scooterId}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {v.scooterLabel}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.assignedRiderName ?? "—"}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {v.leaseStatus}
                        </td>
                        <td className="px-4 py-3 tabular">
                          ₹
                          {v.residualAtRiskInr.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedVehicle(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.scooterLabel}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <p className="text-sm text-muted-foreground">
                  {selected.assignedRiderName ?? "No rider"} · service{" "}
                  {selected.service.nextServiceLabel.toLowerCase()}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Meta
                    label="Spent"
                    value={`₹${selected.service.currentMonthSpendInr}`}
                  />
                  <Meta
                    label="Next 30d"
                    value={`₹${selected.service.expectedNext30Inr}`}
                  />
                  <Meta label="Condition" value={`${selected.healthScore}`} />
                  <Meta label="Pack" value={`${selected.packSohPct}%`} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Issues</p>
                  {selected.issues.length === 0 && (
                    <p className="text-sm text-muted-foreground">None open</p>
                  )}
                  {selected.issues.map((issue) => {
                    const st = statusOf(issue);
                    return (
                      <div
                        key={issue.id}
                        className="rounded-lg border border-border px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{issue.title}</p>
                          <Badge variant="outline" className="capitalize">
                            {st}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {issueKindLabel(issue.kind)} · {issue.detail}
                        </p>
                        {st === "open" && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="h-8"
                              onClick={() => onIssue(issue)}
                            >
                              {issue.actionLabel}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() =>
                                patchIssue(issue.id, "fixed", "Marked fixed")
                              }
                            >
                              Fixed
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-2">
                  <Button onClick={() => changeRider(selected)}>
                    Change rider
                  </Button>
                  <Button variant="outline" onClick={() => bookBay(selected)}>
                    Book bay
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!selectedDriver}
        onOpenChange={(o) => !o && setSelectedRider(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selectedDriver && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedDriver.riderName}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <p className="text-sm text-muted-foreground">
                  {selectedDriver.usualArea} ·{" "}
                  {selectedDriver.assignedScooter ?? "No bike"}
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Issues</p>
                  {selectedDriver.issues.map((issue) => {
                    const st = statusOf(issue);
                    return (
                      <div
                        key={issue.id}
                        className="rounded-lg border border-border px-3 py-2.5 text-sm"
                      >
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {issue.detail}
                        </p>
                        {st === "open" && (
                          <Button
                            size="sm"
                            className="mt-2 h-8"
                            onClick={() => onIssue(issue)}
                          >
                            {issue.actionLabel}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile bottom branch */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge =
              item.id === "overview"
                ? todoLeft
                : item.id === "service"
                  ? portfolio.bikesDueSoon
                  : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute top-0.5 right-1 min-w-4 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground tabular">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <AiOpsCopilot
        brief={brief}
        handlers={{
          onNavigate: setTab,
          onFilterHealth: () => setTab("health"),
          onOptimize: () => {
            optimizeMatch();
            setTab("allocation");
          },
          onQueueReassign: () => changeRider(),
          onQueueWorkshop: () => bookBay(),
        }}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface px-2.5 py-2.5 sm:px-3 sm:py-3">
      <p className="text-[10px] text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-[-0.03em] tabular sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function CostBucket({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold tabular">
        ₹{value.toLocaleString("en-IN")}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function JumpCard({
  title,
  blurb,
  onClick,
}: {
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface px-4 py-3 text-left transition-colors hover:border-primary/40"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular">{value}</p>
    </div>
  );
}
