"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FIXTURE } from "@/lib/fixture";
import {
  createChallenge,
  evaluateAssignment,
  inferUsagePattern,
} from "@/lib/scoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ChallengePage() {
  const params = useSearchParams();
  const [longRangeTo, setLongRangeTo] = useState<"asha" | "ravi" | null>(null);
  const [outage, setOutage] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (params.get("c")) setHint(true);
  }, [params]);

  const criticalRiders = FIXTURE.riders.filter((r) =>
    FIXTURE.criticalRiderIds.includes(r.id),
  );

  const result = useMemo(() => {
    if (!longRangeTo) return null;
    return evaluateAssignment(FIXTURE, longRangeTo, outage);
  }, [longRangeTo, outage]);

  async function challengeSomeone() {
    if (!result || !longRangeTo) return;
    const created = await createChallenge({
      longRangeTo,
      outage,
      bookingsSupported: result.bookingsSupported,
      bookingsTotal: result.bookingsTotal,
    });
    const url = `${window.location.origin}/challenge?c=${created.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Challenge link copied");
    } catch {
      toast.message("Challenge link", { description: url });
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="space-y-1">
        <Badge variant="secondary">20s challenge</Badge>
        <h1 className="text-2xl font-bold tracking-[-0.035em]">
          Who gets the 65 km scooter?
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Shareable demo of the same handover decision — usage patterns, not
          fixed routes.
        </p>
      </div>

      {hint && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--warn)_30%,var(--border))] bg-[var(--warn-wash)] px-3 py-2 text-sm text-[var(--warn)]">
          A friend challenged you — make your own call.
        </div>
      )}

      {!result && (
        <Card className="uiverse-soft-card border-border/80 shadow-none">
          <CardHeader>
            <CardDescription className="leading-relaxed">
              Two delivery riders are waiting. Fleetpair reads how they’ve been
              riding. One pack has 40 km usable range, the other 65 km.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {criticalRiders.map((rider) => {
                const pattern = inferUsagePattern(rider);
                return (
                  <div
                    key={rider.id}
                    className="rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <p className="font-semibold">{rider.name}</p>
                    <p className="mt-1 text-2xl font-bold tracking-[-0.03em] tabular">
                      {rider.dailyKm}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">
                        km typical
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium">{pattern.label}</p>
                    <p className="text-xs text-muted-foreground">
                      observed gap {rider.longestLegKm} km
                    </p>
                  </div>
                );
              })}
            </div>

            {showPatterns && (
              <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {criticalRiders.map((rider) => {
                  const pattern = inferUsagePattern(rider);
                  return (
                    <p key={rider.id}>
                      <strong className="text-foreground">{rider.name}:</strong>{" "}
                      {pattern.detail}
                    </p>
                  );
                })}
              </div>
            )}

            <div className="grid gap-2">
              <button
                type="button"
                className="uiverse-cta w-full"
                onClick={() => {
                  setLongRangeTo("asha");
                  setPulse((n) => n + 1);
                }}
              >
                Give it to Asha
              </button>
              <button
                type="button"
                className="uiverse-cta w-full"
                onClick={() => {
                  setLongRangeTo("ravi");
                  setPulse((n) => n + 1);
                }}
              >
                Give it to Ravi
              </button>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => setShowPatterns((v) => !v)}
              >
                {showPatterns ? "Hide patterns" : "View usage patterns"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="uiverse-soft-card border-border/80 shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="capitalize">
                {longRangeTo} got the 65 km scooter
              </CardTitle>
              <CardDescription>Pattern fit on the critical pair</CardDescription>
            </div>
            <Button
              className="h-9"
              onClick={() => {
                setLongRangeTo(longRangeTo === "asha" ? "ravi" : "asha");
                setPulse((n) => n + 1);
              }}
            >
              Switch
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.pairings.map((p) => {
              const fill = Math.min(100, (p.usableKm / 70) * 100);
              const marker = Math.min(100, (p.longestLegKm / 70) * 100);
              return (
                <div key={`${p.riderId}-${pulse}`} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold capitalize">{p.riderId}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border",
                        p.fit.supportsBooking
                          ? "border-[color-mix(in_srgb,var(--go)_30%,white)] bg-[var(--go-wash)] text-[var(--go)]"
                          : "border-[color-mix(in_srgb,var(--warn)_30%,white)] bg-[var(--warn-wash)] text-[var(--warn)]",
                      )}
                    >
                      {p.fit.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] tabular text-muted-foreground">
                    {p.usableKm} km pack · observed gap {p.longestLegKm} km
                  </p>
                  <div className="route-track">
                    <div
                      className={cn(
                        "route-fill",
                        p.fit.supportsBooking ? "fit" : "short",
                      )}
                      style={{ width: `${fill}%` }}
                    />
                    <div
                      className="route-marker"
                      style={{ left: `${marker}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Critical bookings
                </p>
                <p className="mt-1 text-xl font-bold tabular">
                  {result.bookingsSupported} of {result.bookingsTotal}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Rent from pair
                </p>
                <p className="mt-1 text-xl font-bold tabular">
                  ₹{result.grossRentInr}
                </p>
              </div>
            </div>

            <div className="flex h-10 items-center gap-2">
              <Switch
                id="challenge-outage"
                checked={outage}
                onCheckedChange={setOutage}
              />
              <Label htmlFor="challenge-outage">Nearby swap station offline</Label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="uiverse-cta" onClick={challengeSomeone}>
                Challenge someone
              </button>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  setLongRangeTo(null);
                  setOutage(false);
                }}
              >
                Play again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
