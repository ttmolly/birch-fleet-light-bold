export const PHASES = ["enroute", "approach", "land", "rtl", "hold"] as const;
export type Phase = (typeof PHASES)[number];
export const CLEARANCES = ["low", "ok", "tight"] as const;
export type Clearance = (typeof CLEARANCES)[number];

export interface ParsedState {
  distance: number;
  altitude: number;
  battery: number;
  gps: boolean;
  obstacle: string;
  gap: number;
  target: "visible" | "hidden" | "none";
  overPad: boolean;
}

export interface PilotAnswer {
  phase: Phase;
  threat: boolean;
  clearance: Clearance;
  seeTarget: boolean;
  confidence: number;
}

export const FEAT = 16;
export const OUT = 12;

const DIST_CENTERS = [1.5, 4, 8, 40];
const DIST_SIGMA = [1.3, 2.1, 3.2, 16];

export function parseStateText(text: string): ParsedState {
  const lower = text.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  const numAfter = (key: string, fallback: number) => {
    const i = tokens.indexOf(key);
    if (i < 0 || i + 1 >= tokens.length) return fallback;
    const n = Number(tokens[i + 1]);
    return Number.isFinite(n) ? n : fallback;
  };
  const wordAfter = (key: string, fallback: string) => {
    const i = tokens.indexOf(key);
    if (i < 0 || i + 1 >= tokens.length) return fallback;
    return tokens[i + 1] ?? fallback;
  };
  const obstacle = wordAfter("obstacle", "none");
  const targetWord = wordAfter("target", "none");
  const target: ParsedState["target"] =
    targetWord === "visible" || targetWord === "hidden" || targetWord === "none"
      ? targetWord
      : "none";
  const gpsWord = wordAfter("gps", "yes");
  const gapDefault = obstacle === "none" ? 30 : 4;
  return {
    distance: numAfter("distance", 0),
    altitude: numAfter("altitude", 0),
    battery: numAfter("battery", 100),
    gps: gpsWord !== "no",
    obstacle,
    gap: numAfter("gap", gapDefault),
    target,
    overPad: lower.includes("over pad"),
  };
}

/** Teacher. Far and healthy = enroute, close = approach, over the pad = land, low battery or lost GPS = rtl. */
export function rulesAnswer(text: string): PilotAnswer {
  const s = parseStateText(text);
  let phase: Phase;
  if (s.battery < 20 || !s.gps) phase = "rtl";
  else if (s.overPad) phase = "land";
  else if (s.distance <= 8) phase = "approach";
  else phase = "enroute";

  const threat = s.obstacle !== "none" && s.gap < 10;
  let clearance: Clearance = "low";
  if (s.obstacle !== "none") {
    if (s.gap < 5) clearance = "tight";
    else if (s.gap < 12) clearance = "ok";
    else clearance = "low";
  }
  return {
    phase,
    threat,
    clearance,
    seeTarget: s.target === "visible",
    confidence: 1,
  };
}

export function featuresOf(text: string, blindDistance = false): Float64Array {
  const s = parseStateText(text);
  const x = new Float64Array(FEAT);
  // Held-out distance (and the altitude proxy) so a shipped student can be weak on purpose.
  const d = blindDistance ? 46 : s.distance;
  const altitude = blindDistance ? 12 : s.altitude;
  x[0] = Math.min(Math.max(d, 0), 150) / 150;
  for (let k = 0; k < DIST_CENTERS.length; k++) {
    const c = DIST_CENTERS[k] ?? 0;
    const sig = DIST_SIGMA[k] ?? 1;
    const z = (d - c) / sig;
    x[1 + k] = Math.exp(-0.5 * z * z);
  }
  x[5] = Math.min(Math.max(altitude, 0), 50) / 50;
  x[6] = Math.min(Math.max(s.battery, 0), 100) / 100;
  x[7] = s.gps ? 1 : 0;
  x[8] = s.overPad ? 1 : 0;
  x[9] = s.obstacle === "none" ? 1 : 0;
  x[10] = s.obstacle === "trunk" ? 1 : 0;
  x[11] = s.obstacle !== "none" && s.obstacle !== "trunk" ? 1 : 0;
  x[12] = s.target === "visible" ? 1 : 0;
  x[13] = s.target === "hidden" ? 1 : 0;
  x[14] = Math.min(Math.max(s.gap, 0), 40) / 40;
  x[15] = 1;
  return x;
}

export function buildStateText(s: {
  map?: string;
  distance: number;
  altitude: number;
  battery: number;
  gps: boolean;
  obstacle: string;
  gap: number;
  target: "visible" | "hidden" | "none";
  overPad: boolean;
}): string {
  const parts = [
    s.map ? `map ${s.map}` : "",
    `distance ${Math.round(s.distance)}`,
    `altitude ${Math.round(s.altitude)}`,
    `battery ${Math.round(s.battery)}`,
    `gps ${s.gps ? "yes" : "no"}`,
    `obstacle ${s.obstacle || "none"}`,
    `gap ${Math.round(s.gap)}`,
    `target ${s.target}`,
  ].filter(Boolean);
  if (s.overPad) parts.push("over pad");
  return parts.join(" ");
}

export interface GateSpec {
  name: string;
  text: string;
  expect: Phase;
}

export const GATES: GateSpec[] = [
  {
    name: "far",
    text: "map corvid distance 80 altitude 15 battery 90 gps yes obstacle none gap 30 target visible",
    expect: "enroute",
  },
  {
    name: "distance 4",
    text: "map heron distance 4 altitude 8 battery 80 gps yes obstacle none gap 20 target visible",
    expect: "approach",
  },
  {
    name: "over the pad",
    text: "map falcon distance 1 altitude 2 battery 70 gps yes obstacle none gap 16 target visible over pad",
    expect: "land",
  },
  {
    name: "battery 15",
    text: "map corvid distance 40 altitude 12 battery 15 gps yes obstacle none gap 22 target visible",
    expect: "rtl",
  },
  {
    name: "gps lost",
    text: "map heron distance 30 altitude 10 battery 60 gps no obstacle none gap 18 target none",
    expect: "rtl",
  },
];

export function phaseIndex(phase: Phase): number {
  return PHASES.indexOf(phase);
}

export function clearanceIndex(c: Clearance): number {
  return CLEARANCES.indexOf(c);
}
