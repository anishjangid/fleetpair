"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="More info"
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
