"use client";

import { CheckCircle2 } from "lucide-react";
import {
  SECTION_META,
  countBySeverity,
  groupBySection,
  type AttentionItem,
  type AttentionSection,
  type AttentionSeverity,
} from "@/lib/attention";
import { InfoTip } from "@/components/ui/info-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  now: "Do now",
  watch: "Watch",
  later: "When free",
};

export function AttentionQueue({
  items,
  severityFilter,
  onSeverityFilter,
  dismissed,
  onAct,
  onDismiss,
}: {
  items: AttentionItem[];
  severityFilter: AttentionSeverity | "all";
  onSeverityFilter: (s: AttentionSeverity | "all") => void;
  dismissed: Set<string>;
  onAct: (item: AttentionItem) => void;
  onDismiss: (id: string) => void;
}) {
  const open = items.filter((i) => !dismissed.has(i.id));
  const visible =
    severityFilter === "all"
      ? open
      : open.filter((i) => i.severity === severityFilter);
  const counts = countBySeverity(open);
  const groups = groupBySection(visible);

  return (
    <Card className="uiverse-soft-card border-border/80 shadow-none">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold">Needs doing</p>
            <InfoTip text="Only items you can act on this morning. Do it or skip." />
            <Badge variant="secondary" className="tabular">
              {counts.total}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All", counts.total],
                ["now", "Do now", counts.now],
                ["watch", "Watch", counts.watch],
                ["later", "When free", counts.later],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => onSeverityFilter(value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                  severityFilter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                  value === "now" &&
                    severityFilter !== value &&
                    count > 0 &&
                    "border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))]",
                )}
              >
                {label}
                <span className="tabular opacity-80">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-[var(--go)]" />
            Nothing here
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {groups.map(({ section, items: sectionItems }) => (
              <SectionBlock
                key={section}
                section={section}
                items={sectionItems}
                onAct={onAct}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionBlock({
  section,
  items,
  onAct,
  onDismiss,
}: {
  section: AttentionSection;
  items: AttentionItem[];
  onAct: (item: AttentionItem) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2.5">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {SECTION_META[section].label}
        </p>
        <span className="text-[11px] tabular text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <AttentionRow
            key={item.id}
            item={item}
            onAct={() => onAct(item)}
            onDismiss={() => onDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AttentionRow({
  item,
  onAct,
  onDismiss,
}: {
  item: AttentionItem;
  onAct: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityPill severity={item.severity} />
            <p className="text-sm font-medium">{item.title}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.entity} · {item.impact}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Button size="xs" className="h-7" onClick={onAct}>
          {item.actionLabel}
        </Button>
        <Button size="xs" variant="ghost" className="h-7" onClick={onDismiss}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: AttentionSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        severity === "now" && "bg-destructive/10 text-destructive",
        severity === "watch" && "bg-[var(--warn-wash)] text-[var(--warn)]",
        severity === "later" && "bg-muted text-muted-foreground",
      )}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function SectionActionBar({
  section,
  items,
  dismissed,
  onAct,
  onDismiss,
  emptyLabel = "Nothing to do here",
}: {
  section: AttentionSection;
  items: AttentionItem[];
  dismissed: Set<string>;
  onAct: (item: AttentionItem) => void;
  onDismiss: (id: string) => void;
  emptyLabel?: string;
}) {
  const open = items.filter(
    (i) => i.section === section && !dismissed.has(i.id),
  );

  if (open.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-[var(--go)]" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          On this page · {SECTION_META[section].label}
        </p>
        <Badge variant="secondary" className="h-5 tabular">
          {open.length}
        </Badge>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {open.map((item) => (
          <AttentionRow
            key={item.id}
            item={item}
            onAct={() => onAct(item)}
            onDismiss={() => onDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
