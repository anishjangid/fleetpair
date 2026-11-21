"use client";

import { useMemo, useState } from "react";
import { FIXTURE } from "@/lib/fixture";
import {
  assignRider,
  autoAssignWaiting,
  evaluateHub,
  releaseRider,
} from "@/lib/scoring";
import type { AssignmentMap } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function DispatchBoard({
  assignments,
  onAssignmentsChange,
}: {
  assignments: AssignmentMap;
  onAssignmentsChange: (next: AssignmentMap) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hub = useMemo(
    () => evaluateHub(FIXTURE, assignments, false),
    [assignments],
  );
  const selected = hub.floor.find((p) => p.riderId === selectedId) ?? null;
  const waiting = hub.floor.filter((f) => f.status === "waiting");
  const out = hub.floor.filter((f) => f.status === "out");

  function giveSuggested(riderId: string, scooterId: string | null) {
    if (!scooterId) {
      toast.message("No free bike");
      return;
    }
    onAssignmentsChange(assignRider(assignments, riderId, scooterId));
    toast.success("Bike handed over");
  }

  function bringBack(riderId: string) {
    onAssignmentsChange(releaseRider(assignments, riderId));
    toast.success("Bike back at hub");
  }

  function assignAllWaiting() {
    const next = autoAssignWaiting(FIXTURE, assignments);
    onAssignmentsChange(next);
    toast.success("Waiting riders matched");
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="surface flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            Out{" "}
            <strong className="tabular">
              {hub.outCount}
            </strong>
          </span>
          <span>
            Waiting{" "}
            <strong className="tabular">{hub.waitingCount}</strong>
          </span>
          <span>
            Free bikes{" "}
            <strong className="tabular">{hub.freeBikes.length}</strong>
          </span>
          <span>
            Rent now <strong className="tabular">₹{hub.grossRentInr}</strong>
          </span>
        </div>
        {waiting.length > 0 && hub.freeBikes.length > 0 && (
          <Button size="sm" className="h-8" onClick={assignAllWaiting}>
            Match waiting
          </Button>
        )}
      </div>

      {hub.note && (
        <p className="text-sm text-muted-foreground">{hub.note}</p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5 sm:px-4">
            <p className="text-sm font-semibold">Waiting</p>
            <Badge variant="secondary" className="tabular">
              {waiting.length}
            </Badge>
          </div>
          <ul className="divide-y divide-border">
            {waiting.map((f) => (
              <li
                key={f.riderId}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(f.riderId)}
                  className="min-w-0 text-left"
                >
                  <p className="font-medium">{f.riderName}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.usualArea} · needs ~{f.longestLegKm} km gap
                  </p>
                  {f.suggestedScooterLabel && (
                    <p className="mt-1 text-xs text-[var(--go)]">
                      Suggest {f.suggestedScooterLabel} · {f.suggestedUsableKm}{" "}
                      km · {f.suggestedFit?.label}
                    </p>
                  )}
                </button>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={!f.suggestedScooterId}
                  onClick={() =>
                    giveSuggested(f.riderId, f.suggestedScooterId)
                  }
                >
                  Give bike
                </Button>
              </li>
            ))}
            {waiting.length === 0 && (
              <li className="px-3 py-6 text-sm text-muted-foreground sm:px-4">
                Nobody waiting — riders can check in anytime.
              </li>
            )}
          </ul>
        </div>

        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5 sm:px-4">
            <p className="text-sm font-semibold">Out on bikes</p>
            <Badge variant="secondary" className="tabular">
              {out.length}
            </Badge>
          </div>
          <ul className="divide-y divide-border">
            {out.map((f) => {
              const p = f.pairing!;
              return (
                <li
                  key={f.riderId}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(f.riderId)}
                    className="min-w-0 text-left"
                  >
                    <p className="font-medium">{f.riderName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.scooterLabel} · {p.usableKm} km pack
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        p.fit.supportsBooking
                          ? "text-[var(--go)]"
                          : "text-[var(--warn)]",
                      )}
                    >
                      {p.fit.label}
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => bringBack(f.riderId)}
                  >
                    Bring back
                  </Button>
                </li>
              );
            })}
            {out.length === 0 && (
              <li className="px-3 py-6 text-sm text-muted-foreground sm:px-4">
                No one out yet.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-border px-3 py-2.5 text-sm font-semibold sm:px-4">
          Free bikes
        </div>
        <ul className="divide-y divide-border sm:grid sm:grid-cols-2 sm:divide-y-0">
          {hub.freeBikes.map((b) => (
            <li
              key={b.scooterId}
              className="flex items-center justify-between px-3 py-3 sm:border-b sm:border-border sm:px-4"
            >
              <div>
                <p className="text-sm font-medium">{b.scooterLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {b.packLabel} · {b.usableKm} km usable
                </p>
              </div>
              {waiting[0] && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    giveSuggested(waiting[0].riderId, b.scooterId)
                  }
                >
                  Give to {waiting[0].riderName}
                </Button>
              )}
            </li>
          ))}
          {hub.freeBikes.length === 0 && (
            <li className="px-3 py-6 text-sm text-muted-foreground sm:px-4">
              All bikes out.
            </li>
          )}
        </ul>
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
                <Meta label="Status" value={selected.status} />
                <Meta label="Area" value={selected.usualArea} />
                <Meta label="Swap gap" value={`${selected.longestLegKm} km`} />
                <Meta label="Typical day" value={`${selected.dailyKm} km`} />
                <Meta label="Pattern" value={selected.pattern.label} />
                <Meta
                  label="Wear"
                  value={`${selected.wear.score} · ${selected.wear.band}`}
                />
                {selected.pairing && (
                  <>
                    <Meta label="Bike" value={selected.pairing.scooterLabel} />
                    <Meta
                      label="Pack"
                      value={`${selected.pairing.usableKm} km`}
                    />
                  </>
                )}
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
