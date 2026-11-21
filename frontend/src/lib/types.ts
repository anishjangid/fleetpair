export type WearBand = "learning" | "low" | "review" | "elevated";

export interface Pack {
  id: string;
  label: string;
  dispatchClear: boolean;
  ratedUsableKwh: number;
  testedSohPct: number;
  departureSocPct: number;
}

export interface Scooter {
  id: string;
  label: string;
  packId: string;
  dispatchClear: boolean;
  inspectionPassPct: number;
  roadworthyDays: number;
  observedDays: number;
  kmToService: number;
  serviceIntervalKm: number;
  whPerKm: number;
}

export interface Rider {
  id: string;
  name: string;
  /** Soft signal only - delivery areas drift; not a fixed route. */
  usualArea: string;
  /** Typical day distance inferred from recent tracked shifts. */
  dailyKm: number;
  /**
   * Longest observed gap between dependable swaps (or end of shift).
   * Derived from rider + vehicle behaviour, not a planned itinerary.
   */
  longestLegKm: number;
  trackedShifts: number;
  trackedKm: number;
  coveragePct: number;
  damageIncidents: number;
  highLoadEpisodes: number;
  peerDataReady: boolean;
}

export interface WearResult {
  score: number;
  band: WearBand;
  learning: boolean;
  damagePoints: number;
  highLoadPoints: number;
}

export interface FitResult {
  status: "fit" | "short" | "hold" | "service";
  marginKm: number | null;
  supportsBooking: boolean;
  label: string;
}

export interface UsagePattern {
  label: string;
  detail: string;
  typicalDayKm: number;
  maxSwapGapKm: number;
  historyDepth: string;
}

export interface Pairing {
  riderId: string;
  riderName: string;
  usualArea: string;
  dailyKm: number;
  longestLegKm: number;
  pattern: UsagePattern;
  scooterId: string;
  scooterLabel: string;
  packId: string;
  packLabel: string;
  usableKm: number;
  fit: FitResult;
  wear: WearResult;
  readiness: number;
  handoverAction: string;
  plainLanguage: string;
}

/** riderId → scooterId when out; null when waiting at the hub. */
export type AssignmentMap = Record<string, string | null>;

export type FloorRiderStatus = "waiting" | "out" | "off";

export interface FloorRider {
  riderId: string;
  riderName: string;
  usualArea: string;
  dailyKm: number;
  longestLegKm: number;
  pattern: UsagePattern;
  wear: WearResult;
  status: FloorRiderStatus;
  pairing: Pairing | null;
  /** Best free bike suggestion when waiting */
  suggestedScooterId: string | null;
  suggestedScooterLabel: string | null;
  suggestedUsableKm: number | null;
  suggestedFit: FitResult | null;
}

export interface FreeBike {
  scooterId: string;
  scooterLabel: string;
  packLabel: string;
  usableKm: number;
  readiness: number;
}

export interface HubResult {
  hubName: string;
  shiftLabel: string;
  outage: boolean;
  scaleMaxKm: number;
  /** Active out-on-bike pairings only */
  pairings: Pairing[];
  floor: FloorRider[];
  freeBikes: FreeBike[];
  waitingCount: number;
  outCount: number;
  bookingsSupported: number;
  bookingsTotal: number;
  grossRentInr: number;
  dailyRentInr: number;
  techHandovers: number;
  rentAtRiskInr: number;
  note: string | null;
}

export interface Fixture {
  hubName: string;
  shiftLabel: string;
  dailyRentInr: number;
  reserveSocPct: number;
  riders: Rider[];
  scooters: Scooter[];
  packs: Pack[];
  outage: { riderId: string; longestLegKm: number };
  /** Kept for challenge share mode only */
  criticalRiderIds: [string, string];
  /** Starting floor: riderId → scooterId | null (null = waiting) */
  initialAssignments: AssignmentMap;
  scenarioLabel: string;
}

/** Narrow result used by the shareable 2-rider challenge mode. */
export interface EvaluateResult {
  longRangeTo: string;
  outage: boolean;
  scaleMaxKm: number;
  pairings: Array<{
    riderId: string;
    dailyKm: number;
    longestLegKm: number;
    scooterId: string;
    packId: string;
    usableKm: number;
    fit: FitResult;
    wear: WearResult;
    readiness: number;
    handoverAction: string;
    plainLanguage: string;
    scoreBreakdown: {
      wearFormula: string;
      damagePoints: number;
      highLoadPoints: number;
      readinessFormula: string;
      readiness: number;
      rangeFormula: string;
    };
  }>;
  bookingsSupported: number;
  bookingsTotal: number;
  grossRentInr: number;
  dailyRentInr: number;
  note: string | null;
  scooterRanges: { x: number; y: number };
}
