/**
 * Floor voice / typed commands for the hub manager.
 */

export type OpsTab =
  | "overview"
  | "allocation"
  | "health"
  | "drivers"
  | "leases"
  | "service"
  | "map";

export type HealthFilter = "all" | "strong" | "watch" | "at-risk";

export type AiIntent =
  | { type: "navigate"; tab: OpsTab; reply: string }
  | { type: "filter_health"; filter: HealthFilter; reply: string }
  | { type: "optimize"; reply: string }
  | { type: "queue_reassign"; vehicleHint?: string; reply: string }
  | { type: "queue_workshop"; reply: string }
  | { type: "brief"; reply: string }
  | { type: "unknown"; reply: string };

export type FleetBriefInput = {
  avgHealth: number;
  atRiskUnits: number;
  residualAtRiskInr: number;
  matchingQualityPct: number;
  earningUnits: number;
};

export function buildMorningBrief(f: FleetBriefInput): string {
  const residualK = Math.round(f.residualAtRiskInr / 1000);
  if (f.atRiskUnits > 0) {
    return `${f.atRiskUnits} bike${f.atRiskUnits === 1 ? "" : "s"} in bad shape. About ₹${residualK}k of resale value is shaky. ${f.matchingQualityPct}% of riders covered. Want me to change a rider or open service?`;
  }
  return `Board looks fine — ${f.earningUnits} bikes earning, condition avg ${f.avgHealth}, all riders covered. I can open service or check a rider.`;
}

export function parseOpsIntent(raw: string, brief: FleetBriefInput): AiIntent {
  const q = raw.trim().toLowerCase();
  if (!q) {
    return {
      type: "unknown",
      reply: "Say something like “how's the board” or “bad bikes”.",
    };
  }

  if (
    /(morning|fleet)?\s*brief|status|summary|how('?s| is) (the )?(fleet|board|hub)/.test(
      q,
    )
  ) {
    return { type: "brief", reply: buildMorningBrief(brief) };
  }

  if (/allocat|dispatch|match|pairing|who gets|critical|long pack/.test(q)) {
    return {
      type: "navigate",
      tab: "allocation",
      reply: "Opening matches. Check who has the long pack.",
    };
  }

  if (/driver|rider|wear/.test(q) && !/health|vehicle|scooter|bike/.test(q)) {
    return {
      type: "navigate",
      tab: "drivers",
      reply: "Riders — ones hard on the bike sit at the top.",
    };
  }

  if (/lease|residual|rent book|resale|value/.test(q)) {
    return {
      type: "navigate",
      tab: "leases",
      reply: "Rent book — see which bikes are losing value.",
    };
  }

  if (/service|maint|bay|workshop|issues?|cost|spend/.test(q)) {
    return {
      type: "navigate",
      tab: "service",
      reply: "Service board — what's due, what it costs, open issues.",
    };
  }

  if (/fleet health|vehicle health|scooter|bikes?|condition/.test(q)) {
    return {
      type: "navigate",
      tab: "health",
      reply: "Bikes — filter bad ones if you need to pull someone.",
    };
  }

  if (/map|where|zone|location|live board/.test(q)) {
    return {
      type: "navigate",
      tab: "map",
      reply: "Opening the map — bikes in each rider’s usual zone.",
    };
  }

  if (/overview|dashboard|home|board|checklist|jobs/.test(q)) {
    return {
      type: "navigate",
      tab: "overview",
      reply: "Back to Home — morning checklist.",
    };
  }

  if (/at[- ]?risk|critical units|worst|bad bike/.test(q)) {
    return {
      type: "filter_health",
      filter: "at-risk",
      reply: "Showing bikes in bad shape.",
    };
  }

  if (/watch( list)?|borderline|keep an eye/.test(q)) {
    return {
      type: "filter_health",
      filter: "watch",
      reply: "Showing bikes to keep an eye on.",
    };
  }

  if (/strong|healthy|good bike/.test(q)) {
    return {
      type: "filter_health",
      filter: "strong",
      reply: "Showing bikes in good shape.",
    };
  }

  if (/clear filter|show all|reset filter/.test(q)) {
    return {
      type: "filter_health",
      filter: "all",
      reply: "Showing all bikes.",
    };
  }

  if (
    /optim|recommend|fix match|best match|apply recommend|put (the )?best|long pack/.test(
      q,
    )
  ) {
    return {
      type: "optimize",
      reply: "Put the better rider on the long pack.",
    };
  }

  if (/workshop|service|inspect|hold for service|book bay/.test(q)) {
    return {
      type: "queue_workshop",
      reply: "Marked the weakest bike for service hold.",
    };
  }

  if (/reassign|swap|change rider|change bike|move rider|protect/.test(q)) {
    const vehicleHint = q.match(
      /unit\s*([a-z0-9-]+)|scooter\s*([a-z0-9-]+)|sc-?\s*([a-z0-9-]+)/i,
    );
    return {
      type: "queue_reassign",
      vehicleHint: vehicleHint?.[1] ?? vehicleHint?.[2] ?? vehicleHint?.[3],
      reply: "Opening the bike so you can change the rider.",
    };
  }

  return {
    type: "unknown",
    reply:
      "Try: how's the board · bad bikes · open service · open matches · fix long pack · change rider.",
  };
}

export const AI_CHIPS = [
  "How's the board?",
  "Open map",
  "Bad bikes",
  "Open service",
  "Fix long pack",
  "Change rider",
] as const;
