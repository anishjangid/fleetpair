"use client";

import type { AttentionItem } from "@/lib/attention";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Flat morning checklist — no section grids, no severity chrome. */
export function TodoList({
  items,
  dismissed,
  onAct,
  onSkip,
  limit = 5,
}: {
  items: AttentionItem[];
  dismissed: Set<string>;
  onAct: (item: AttentionItem) => void;
  onSkip: (id: string) => void;
  limit?: number;
}) {
  const open = items.filter((i) => !dismissed.has(i.id)).slice(0, limit);

  if (open.length === 0) {
    return (
      <p className="surface px-4 py-6 text-sm text-muted-foreground">
        Nothing urgent. Matches look fine for this morning.
      </p>
    );
  }

  return (
    <ul className="surface divide-y divide-border overflow-hidden">
      {open.map((item, idx) => (
        <li
          key={item.id}
          className={cn(
            "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4",
            item.severity === "now" && "bg-destructive/[0.04]",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 w-5 shrink-0 text-sm tabular text-muted-foreground">
              {idx + 1}.
            </span>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {item.entity}
                {item.impact ? ` — ${item.impact}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-8 sm:pl-0">
            <Button size="sm" className="h-8 flex-1 sm:flex-none" onClick={() => onAct(item)}>
              {item.actionLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => onSkip(item.id)}
            >
              Skip
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
