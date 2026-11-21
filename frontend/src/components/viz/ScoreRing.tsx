"use client";

import { cn } from "@/lib/utils";

export function ScoreRing({
  score,
  label,
  size = 92,
  tone = "primary",
}: {
  score: number;
  label: string;
  size?: number;
  tone?: "primary" | "go" | "warn" | "danger";
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const colors = {
    primary: "var(--primary)",
    go: "var(--go)",
    warn: "var(--warn)",
    danger: "var(--destructive)",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colors[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tracking-[-0.03em] tabular">
            {score}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function MeterBar({
  value,
  max = 100,
  tone = "primary",
  className,
}: {
  value: number;
  max?: number;
  tone?: "primary" | "go" | "warn" | "danger";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bg = {
    primary: "bg-primary",
    go: "bg-[var(--go)]",
    warn: "bg-[var(--warn)]",
    danger: "bg-destructive",
  }[tone];

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", bg)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
