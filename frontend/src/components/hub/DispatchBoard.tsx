"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { FIXTURE } from "@/lib/fixture";
import { evaluateHub } from "@/lib/scoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function DispatchBoard({
  criticalLongTo,
  onCriticalChange,
  recommended,
}: {
  criticalLongTo: string;
  onCriticalChange: (id: string) => void;
  recommended: string;
}) {
  const [outage, setOutage] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hub = useMemo(
    () => evaluateHub(FIXTURE, criticalLongTo, outage),
    [criticalLongTo, outage],
  );
  const selected = hub.pairings.find((p) => p.riderId === selectedId) ?? null;
  const criticalPair = hub.pairings.filter((p) => p.isCritical);
  const isOptimal = criticalLongTo === recommended;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="surface flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            Covered{" "}
            <strong className="tabular">
              {hub.bookingsSupported}/{hub.bookingsTotal}
            </strong>
          </span>
          <span>
            Rent <strong className="tabular">₹{hub.grossRentInr}</strong>
          </span>
          {hub.rentAtRiskInr > 0 && (
            <span className="text-[var(--warn)]">
              At risk <strong className="tabular">₹{hub.rentAtRiskInr}</strong>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="outage" checked={outage} onCheckedChange={setOutage} />
            <Label htmlFor="outage" className="text-xs">
              Station offline
            </Label>
          </div>
          {!isOptimal && (
            <Button
              size="sm"
              className="h-8"
              onClick={() => onCriticalChange(recommended)}
            >
              Use best match
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px] xl:gap-5">
        <div className="surface overflow-hidden">
          <div className="border-b border-border px-3 py-2.5 text-sm font-semibold sm:px-4">
            Who rides what
          </div>
          <ul className="divide-y divide-border">
            {hub.pairings.map((p) => (
              <li key={p.riderId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.riderId)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-3 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4",
                    p.isCritical && "border-l-2 border-l-[var(--warn)]",
                    selectedId === p.riderId && "bg-muted/50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.riderName}</span>
                      {p.isCritical && (
                        <Badge variant="outline" className="h-5 text-[10px]">
                          Long pack fight
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.usualArea} · needs ~{p.longestLegKm} km gap
                    </p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-sm font-medium">{p.scooterLabel}</p>
                    <p
                      className={cn(
                        "text-xs",
                        p.fit.supportsBooking
                          ? "text-[var(--go)]"
                          : "text-[var(--warn)]",
                      )}
                    >
                      {p.usableKm} km pack · {p.fit.label}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface p-4">
          <p className="text-sm font-semibold">
            Long pack ({hub.critical.longRangeKm} km)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only one — give it to who needs the stretch.
          </p>
          <div className="mt-3 space-y-2">
            {criticalPair.map((p) => (
              <button
                key={p.riderId}
                type="button"
                onClick={() => onCriticalChange(p.riderId)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left text-sm",
                  criticalLongTo === p.riderId
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <p className="font-medium">{p.riderName}</p>
                <p className="text-xs text-muted-foreground">
                  Gap {p.longestLegKm} km
                </p>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-3 h-9 w-full"
            onClick={() => {
              const [a, b] = FIXTURE.criticalRiderIds;
              onCriticalChange(criticalLongTo === a ? b : a);
            }}
          >
            <ArrowLeftRight className="size-3.5" />
            Switch
          </Button>
        </div>
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.riderName}</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 px-4 pb-6 text-sm">
                <Meta label="Swap gap" value={`${selected.longestLegKm} km`} />
                <Meta label="Typical day" value={`${selected.dailyKm} km`} />
                <Meta
                  label="Pack"
                  value={`${selected.usableKm} km · ${selected.packLabel}`}
                />
                <Meta label="Bike" value={selected.scooterLabel} />
                <Meta
                  label="Wear"
                  value={`${selected.wear.score} · ${selected.wear.band}`}
                />
                <Meta label="Next" value={selected.handoverAction} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold capitalize">{value}</p>
    </div>
  );
}
