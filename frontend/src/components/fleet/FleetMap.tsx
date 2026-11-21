"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { jitterLatLng, resolveAreaLocation } from "@/lib/locations";
import type { DriverInsight, VehicleInsight } from "@/lib/fleet-insights";
import type { OsmMapUnit } from "@/components/fleet/OsmMapInner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MapSort = "all" | "service" | "risk" | "stress";

const OsmMapInner = dynamic(
  () =>
    import("@/components/fleet/OsmMapInner").then((m) => m.OsmMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center bg-[#e8eef2] text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

type MapUnit = OsmMapUnit & {
  riderId: string | null;
  area: string;
  residualAtRiskInr: number;
  stress: number;
};

function buildUnits(
  vehicles: VehicleInsight[],
  drivers: DriverInsight[],
): MapUnit[] {
  const byRider = Object.fromEntries(drivers.map((d) => [d.riderId, d]));
  return vehicles.map((v) => {
    const driver = v.assignedRiderId ? byRider[v.assignedRiderId] : null;
    const area = driver?.usualArea ?? "Indiranagar (new)";
    const loc = resolveAreaLocation(area);
    const point = jitterLatLng(v.scooterId, loc.lat, loc.lng);
    return {
      scooterId: v.scooterId,
      scooterLabel: v.scooterLabel,
      riderName: v.assignedRiderName,
      riderId: v.assignedRiderId,
      area,
      areaShort: loc.short,
      lat: point.lat,
      lng: point.lng,
      healthScore: v.healthScore,
      serviceDays: v.service.nextServiceInDays,
      residualAtRiskInr: v.residualAtRiskInr,
      stress: v.pairingStress,
      openIssues: v.service.openIssueCount,
    };
  });
}

export function FleetMap({
  vehicles,
  drivers,
  onOpenBike,
}: {
  vehicles: VehicleInsight[];
  drivers: DriverInsight[];
  onOpenBike: (scooterId: string) => void;
}) {
  const [sort, setSort] = useState<MapSort>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const units = useMemo(
    () => buildUnits(vehicles, drivers),
    [vehicles, drivers],
  );

  const filtered = useMemo(() => {
    switch (sort) {
      case "service":
        return units
          .filter((u) => u.serviceDays <= 10)
          .sort((a, b) => a.serviceDays - b.serviceDays);
      case "risk":
        return units
          .filter((u) => u.residualAtRiskInr >= 8000)
          .sort((a, b) => b.residualAtRiskInr - a.residualAtRiskInr);
      case "stress":
        return units
          .filter((u) => u.stress >= 45)
          .sort((a, b) => b.stress - a.stress);
      default:
        return units
          .slice()
          .sort((a, b) => a.scooterLabel.localeCompare(b.scooterLabel));
    }
  }, [units, sort]);

  const selected =
    filtered.find((u) => u.scooterId === selectedId) ??
    units.find((u) => u.scooterId === selectedId) ??
    null;

  return (
    <section className="space-y-4">
      <div className="surface space-y-3 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Live board map</p>
            <p className="text-xs text-muted-foreground">
              Usual zones. Not live GPS.
            </p>
          </div>
          <Badge variant="secondary" className="tabular">
            {filtered.length} shown
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All bikes"],
              ["service", "Service soon"],
              ["risk", "Value risk"],
              ["stress", "Hard use"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSort(id)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                sort === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="surface relative overflow-hidden">
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/10] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#e8eef2]">
            <OsmMapInner
              units={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <div className="surface flex max-h-[420px] flex-col overflow-hidden">
          <div className="border-b border-border px-3 py-2.5 text-sm font-semibold">
            Quick list
          </div>
          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {filtered.map((u) => (
              <li key={u.scooterId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(u.scooterId)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left hover:bg-muted/50",
                    selectedId === u.scooterId && "bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{u.scooterLabel}</p>
                    <span className="text-[11px] tabular text-muted-foreground">
                      {u.healthScore}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {u.riderName ?? "No rider"} · {u.areaShort}
                  </p>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-sm text-muted-foreground">
                Nothing in this filter
              </li>
            )}
          </ul>

          {selected && (
            <div className="space-y-2 border-t border-border px-3 py-3">
              <p className="text-sm font-semibold">
                {selected.scooterLabel}
                {selected.riderName ? ` · ${selected.riderName}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.area} · service in {selected.serviceDays}d ·{" "}
                {selected.openIssues} issues
              </p>
              <Button
                size="sm"
                className="h-8 w-full"
                onClick={() => onOpenBike(selected.scooterId)}
              >
                Open bike
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
