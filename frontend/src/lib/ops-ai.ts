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
  waitingCount?: number;
};

export function buildMorningBrief(f: FleetBriefInput): string {
  const residualK = Math.round(f.residualAtRiskInr / 1000);
  const waiting = f.waitingCount ?? 0;
  if (waiting > 0) {
    return `${waiting} waiting. ${f.earningUnits} out. Match them?`;
  }
  if (f.atRiskUnits > 0) {
    return `${f.atRiskUnits} bikes in bad shape. ~₹${residualK}k value shaky.`;
  }
  return `${f.earningUnits} earning. Condition avg ${f.avgHealth}.`;
}

export function parseOpsIntent(raw: string, brief: FleetBriefInput): AiIntent {
  const q = raw.trim().toLowerCase();
  if (!q) {
    return {
      type: "unknown",
      reply: "Try: how's the board, or bad bikes.",
    };
  }

  if (
    /(morning|fleet)?\s*brief|status|summary|how('?s| is) (the )?(fleet|board|hub|floor)/.test(
      q,
    )
  ) {
    return { type: "brief", reply: buildMorningBrief(brief) };
  }

  if (/allocat|dispatch|match|pairing|who gets|waiting|hand ?over/.test(q)) {
    return {
      type: "navigate",
      tab: "allocation",
      reply: "Opening matches.",
    };
  }

  if (/driver|rider|wear/.test(q) && !/health|vehicle|scooter|bike/.test(q)) {
    return {
      type: "navigate",
      tab: "drivers",
      reply: "Opening riders.",
    };
  }

  if (/lease|residual|rent book|resale|value/.test(q)) {
    return {
      type: "navigate",
      tab: "leases",
      reply: "Opening rent book.",
    };
  }

  if (/service|maint|bay|workshop|issues?|cost|spend|parts/.test(q)) {
    return {
      type: "navigate",
      tab: "service",
      reply: "Opening service.",
    };
  }

  if (/fleet health|vehicle health|scooter|bikes?|condition/.test(q)) {
    return {
      type: "navigate",
      tab: "health",
      reply: "Opening bikes.",
    };
  }

  if (/map|where|zone|location|live board/.test(q)) {
    return {
      type: "navigate",
      tab: "map",
      reply: "Opening map.",
    };
  }

  if (/overview|dashboard|home|board|checklist|jobs/.test(q)) {
    return {
      type: "navigate",
      tab: "overview",
      reply: "Back to home.",
    };
  }

  if (/at[- ]?risk|critical units|worst|bad bike/.test(q)) {
    return {
      type: "filter_health",
      filter: "at-risk",
      reply: "Showing bad bikes.",
    };
  }

  if (/watch( list)?|borderline|keep an eye/.test(q)) {
    return {
      type: "filter_health",
      filter: "watch",
      reply: "Showing watch list.",
    };
  }

  if (/strong|healthy|good bike/.test(q)) {
    return {
      type: "filter_health",
      filter: "strong",
      reply: "Showing good bikes.",
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
    /optim|recommend|fix match|best match|match waiting|assign waiting|auto.?assign/.test(
      q,
    )
  ) {
    return {
      type: "optimize",
      reply: "Matching waiting riders.",
    };
  }

  if (/workshop|service|inspect|hold for service|book bay/.test(q)) {
    return {
      type: "queue_workshop",
      reply: "Booking the bay.",
    };
  }

  if (/reassign|swap|change rider|change bike|move rider|protect/.test(q)) {
    const vehicleHint = q.match(
      /unit\s*([a-z0-9-]+)|scooter\s*([a-z0-9-]+)|sc-?\s*([a-z0-9-]+)/i,
    );
    return {
      type: "queue_reassign",
      vehicleHint: vehicleHint?.[1] ?? vehicleHint?.[2] ?? vehicleHint?.[3],
      reply: "Opening bike to change rider.",
    };
  }

  return {
    type: "unknown",
    reply: "Try: how's the board, bad bikes, match waiting.",
  };
}

export const AI_CHIPS = [
  "How's the board?",
  "Match waiting",
  "Bad bikes",
  "Open service",
] as const;
