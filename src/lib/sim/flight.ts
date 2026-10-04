import { buildStateText, rulesAnswer, type Phase, type PilotAnswer } from "../moka/text.ts";
import { buildWorld, type Vec3, type WorldData } from "./world.ts";

export interface Actor {
  x: number;
  y: number;
  z: number;
  r: number;
  kind: string;
  h: number;
}

export interface LogLine {
  t: number;
  model: string;
  rules: string;
  cmd: string;
  threat: string;
  see: string;
  clearance: string;
  note: string;
}

export interface RowRec {
  text: string;
  mark: "unmarked" | "good" | "bad";
  map: string;
  runId: number;
}

export interface Craft {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
}

export interface AskResult extends PilotAnswer {
  source: "rules" | "moka" | "fallback" | "laya";
  label: string;
}

export interface RunConfig {
  mapId: string;
  modeKind: string;
  world: WorldData;
  goals: Vec3[];
  trackTarget: "marker" | "drone";
  pattern: "shuttle" | "patrol" | "break";
  anchor: Vec3 | null;
  ask: (text: string) => AskResult;
}

export const keys = new Set<string>();

export const live = {
  craft: idleCraft(),
  status: "idle" as "idle" | "running" | "landed" | "failed",
  battery: 100,
  gpsOn: true,
  t: 0,
  runId: 0,
  dist: 0,
  nearest: "none",
  nearestM: 99,
  command: "hold" as Phase,
  modelPhase: "hold" as Phase,
  rulesPhase: "hold" as Phase,
  threat: false,
  see: false,
  clearance: "low" as "low" | "ok" | "tight",
  confidence: 1,
  pilotLabel: "rules",
  weak: false,
  note: "",
  failReason: "",
  lat: 0,
  lon: 0,
  east: 0,
  north: 0,
  alt: 0,
  target: null as Vec3 | null,
  actors: [] as Actor[],
  goals: [] as Vec3[],
  goalIndex: 0,
  log: [] as LogLine[],
  rows: [] as RowRec[],
  world: null as WorldData | null,
  lostFor: 0,
  search: false,
  steerOverride: null as number | null,
  config: null as RunConfig | null,
  decisionAcc: 0,
  logAcc: 0,
  home: { x: 0, y: 0.3, z: 0 } as Vec3,
};

const listeners = new Set<() => void>();
let version = 0;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getVersion() {
  return version;
}

function bump() {
  version += 1;
  for (const fn of listeners) fn();
}

export function refreshHud() {
  bump();
}

function idleCraft(): Craft {
  return { x: 0, y: 0.4, z: 0, vx: 0, vy: 0, vz: 0, yaw: Math.PI };
}

export function steerClimb() {
  let steer = live.steerOverride ?? 0;
  let climb = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) climb += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) climb -= 1;
  return { steer: Math.max(-1, Math.min(1, steer)), climb: Math.max(-1, Math.min(1, climb)) };
}

export function placeOnPad(world: WorldData) {
  const h = world.home;
  live.world = world;
  live.home = { ...h };
  live.craft = { x: h.x, y: h.y + 0.35, z: h.z, vx: 0, vy: 0, vz: 0, yaw: Math.PI };
  live.battery = 100;
  live.t = 0;
  live.status = "idle";
  live.command = "hold";
  live.modelPhase = "hold";
  live.rulesPhase = "hold";
  live.dist = 0;
  live.failReason = "";
  live.note = "";
  live.target = null;
  live.actors = [];
  live.goals = [];
  live.goalIndex = 0;
  live.lostFor = 0;
  live.search = false;
  live.config = null;
  live.decisionAcc = 0;
  publishGps();
  bump();
}

export function arm(config: RunConfig) {
  placeOnPad(config.world);
  live.config = config;
  live.goals = config.goals.map((g) => ({ ...g }));
  live.goalIndex = 0;
  live.status = "running";
  live.runId += 1;
  live.battery = 100;
  live.t = 0;
  bump();
}

export function goHome() {
  const world = live.world;
  if (!world) return;
  const gps = live.gpsOn;
  placeOnPad(world);
  live.gpsOn = gps;
  live.log = [
    {
      t: 0,
      model: "—",
      rules: "—",
      cmd: "hold",
      threat: "no",
      see: "no",
      clearance: "low",
      note: "home",
    },
    ...live.log,
  ].slice(0, 40);
  bump();
}

export function markRun(mark: "good" | "bad") {
  for (const row of live.rows) {
    if (row.runId === live.runId) row.mark = mark;
  }
  bump();
}

export function tick(dt: number) {
  const config = live.config;
  const world = live.world;
  if (!config || !world || live.status !== "running") return;
  const step = Math.min(dt, 0.05);
  live.t += step;
  const craft = live.craft;
  const { steer, climb } = steerClimb();

  const target = trackPoint(config, live.t);
  live.target = config.modeKind === "track" ? target : null;
  live.actors = config.modeKind === "opposed" ? opposedActors(config, live.t) : [];

  live.decisionAcc += step;
  if (live.decisionAcc >= 0.1) {
    live.decisionAcc = 0;
    decide(config, world);
  }

  const goal = activeGoal(config);
  const dx = goal.x - craft.x;
  const dz = goal.z - craft.z;
  const distH = Math.hypot(dx, dz);
  live.dist = distH;

  let dirx = distH > 0.05 ? dx / distH : 0;
  let dirz = distH > 0.05 ? dz / distH : 0;
  const skirt = avoidDir(dirx, dirz, craft, world, live.actors, config.modeKind);
  dirx = skirt.x;
  dirz = skirt.z;

  const phase = live.command;
  let speed = phase === "enroute" ? 8.5 : phase === "approach" ? 3.2 : phase === "land" ? 1.3 : phase === "rtl" ? 9.2 : 0;
  if (phase === "approach" && distH < 3) speed = 1.25;
  if (phase === "land" && distH < 1.15) speed = 0;

  let tvx = dirx * speed;
  let tvz = dirz * speed;
  if (phase === "hold" || live.search) {
    tvx = 0;
    tvz = 0;
  }

  const k = 4.2;
  craft.vx += clamp((tvx - craft.vx) * k, -16, 16) * step;
  craft.vz += clamp((tvz - craft.vz) * k, -16, 16) * step;

  let targetY = world.cruise;
  if (config.modeKind === "track" && live.target) {
    targetY = live.target.y + (phase === "approach" || phase === "land" ? 2.2 : 4.5);
  } else if (phase === "approach") {
    targetY = goal.y + Math.max(1.6, distH * 0.28);
  } else if (phase === "land") {
    targetY = goal.y + 0.32;
  } else if (phase === "hold") {
    targetY = craft.y;
  }
  if (climb !== 0) targetY = craft.y + climb * 6;

  const ay = clamp(((targetY - craft.y) * 2.4 - craft.vy) * 3.2, -10, 10);
  craft.vy += ay * step;

  const moving = Math.hypot(tvx, tvz);
  let desiredYaw = craft.yaw;
  if (moving > 0.4) desiredYaw = Math.atan2(-tvx, -tvz);
  if (Math.abs(steer) > 0.05) craft.yaw += steer * 1.9 * step;
  else if (live.search) craft.yaw += 0.7 * step;
  else {
    const diff = wrap(desiredYaw - craft.yaw);
    craft.yaw += clamp(diff, -2.5 * step, 2.5 * step);
  }

  craft.x += craft.vx * step;
  craft.y += craft.vy * step;
  craft.z += craft.vz * step;
  if (craft.y < 0.3) {
    craft.y = 0.3;
    if (craft.vy < 0) craft.vy = 0;
  }
  resolveBuildings(craft, world);
  resolveSolids(craft, live.actors);

  const sp = Math.hypot(craft.vx, craft.vz);
  live.battery = Math.max(0, live.battery - step * (0.42 + sp * 0.07));
  publishGps();

  if (config.modeKind === "thread") {
    for (const tree of world.trees) {
      if (!tree.lethal) continue;
      const d = Math.hypot(craft.x - tree.x, craft.z - tree.z);
      if (d < tree.r + 0.5 && craft.y < tree.trunkH) {
        live.status = "failed";
        live.failReason = "Hit a trunk";
        live.command = "hold";
        craft.vx = 0;
        craft.vz = 0;
        craft.vy = 0;
        bump();
        return;
      }
    }
  }

  const landing = landingPoint(config);
  const distLand = Math.hypot(craft.x - landing.x, craft.z - landing.z);
  if (
    (phase === "land" || (live.note === "battery" && distLand < 2)) &&
    distLand < 1.35 &&
    Math.abs(craft.y - (landing.y + 0.32)) < 0.55 &&
    sp < 0.8
  ) {
    live.status = "landed";
    craft.vx = 0;
    craft.vz = 0;
    craft.vy = 0;
    craft.y = landing.y + 0.32;
    live.command = "land";
    pushLog("landed");
    bump();
    return;
  }

  if (config.modeKind !== "track" && phase !== "rtl" && phase !== "land") {
    const g = live.goals[live.goalIndex];
    if (g && live.goalIndex < live.goals.length - 1 && distH < 3) {
      live.goalIndex += 1;
    }
  }
}

function decide(config: RunConfig, world: WorldData) {
  const craft = live.craft;
  const goal = activeGoal(config);
  const dist = Math.hypot(goal.x - craft.x, goal.z - craft.z);
  const obs = nearestObs(craft, world, live.actors);
  live.nearest = obs.kind;
  live.nearestM = obs.gap;
  const seeGeom = canSee(craft, goal, world, live.actors);
  const landing = landingPoint(config);
  const distPad = Math.hypot(craft.x - landing.x, craft.z - landing.z);
  const overPad = distPad < 2.15;
  const text = buildStateText({
    map: world.id,
    distance: dist,
    altitude: craft.y,
    battery: live.battery,
    gps: live.gpsOn,
    obstacle: obs.kind,
    gap: obs.gap,
    target: seeGeom ? "visible" : goal ? "hidden" : "none",
    overPad,
  });
  const rules = rulesAnswer(text);
  let asked: AskResult;
  try {
    asked = config.ask(text);
  } catch {
    asked = { ...rules, source: "fallback", label: "rules, not moka" };
  }
  live.modelPhase = asked.phase;
  live.rulesPhase = rules.phase;
  live.threat = asked.threat;
  live.see = asked.seeTarget;
  live.clearance = asked.clearance;
  live.confidence = asked.confidence;
  live.pilotLabel = asked.label;
  live.weak = asked.label.toLowerCase().includes("weak");

  let phase = asked.phase;
  let note = "";
  if (asked.source !== "rules" && asked.confidence < 0.45) {
    phase = "hold";
    note = "low confidence";
  }
  if (config.modeKind === "track") {
    if (!seeGeom) live.lostFor += 0.1;
    else live.lostFor = 0;
    if (live.lostFor >= 12) {
      phase = "rtl";
      note = "target lost";
      live.search = false;
    } else if (live.lostFor >= 2.5) {
      phase = "hold";
      note = "search";
      live.search = true;
    } else {
      live.search = false;
    }
  } else {
    live.search = false;
    live.lostFor = 0;
  }

  const outside = Math.hypot(craft.x, craft.z) > world.fence;
  if (live.battery < 20 || outside) {
    if (distPad < 2.15) phase = "land";
    else phase = "rtl";
    note = live.battery < 20 ? "battery" : "geofence";
    live.search = false;
  }

  live.command = phase;
  live.note = note;
  live.alt = craft.y;

  const row: RowRec = { text, mark: "unmarked", map: world.id, runId: live.runId };
  live.rows.push(row);
  if (live.rows.length > 800) live.rows.splice(0, live.rows.length - 800);

  live.logAcc += 0.1;
  const changed = live.log[0]?.cmd !== phase || live.log[0]?.model !== asked.phase;
  if (changed || live.logAcc >= 1) {
    live.logAcc = 0;
    pushLog(note);
  }
}

function pushLog(note: string) {
  live.log = [
    {
      t: live.t,
      model: `${live.modelPhase}`,
      rules: `${live.rulesPhase}`,
      cmd: live.command,
      threat: live.threat ? "yes" : "no",
      see: live.see ? "yes" : "no",
      clearance: live.clearance,
      note,
    },
    ...live.log,
  ].slice(0, 40);
}

function activeGoal(config: RunConfig): Vec3 {
  if (live.command === "rtl" || live.note === "target lost" || live.note === "battery" || live.note === "geofence") {
    return config.world.home;
  }
  if (config.modeKind === "track" && live.target && live.command !== "land") return live.target;
  const g = live.goals[live.goalIndex];
  return g ?? config.world.home;
}

function landingPoint(config: RunConfig): Vec3 {
  if (config.modeKind === "track") return config.world.home;
  const last = live.goals[live.goals.length - 1];
  if ((live.command === "rtl" || live.note === "battery" || live.note === "geofence") && live.goalIndex <= 0 && live.command === "rtl") {
    return config.world.home;
  }
  if (live.command === "rtl" || live.note === "battery" || live.note === "geofence" || live.note === "target lost") {
    return config.world.home;
  }
  return last ?? config.world.home;
}

function trackPoint(config: RunConfig, t: number): Vec3 {
  const home = config.world.home;
  const anchor = config.anchor ?? { x: home.x + 8, y: config.trackTarget === "drone" ? 5 : 0.3, z: home.z + 22 };
  const y = config.trackTarget === "drone" ? Math.max(4, anchor.y) : 0.35;
  if (config.pattern === "shuttle") {
    const u = (Math.sin(t * 0.45) + 1) / 2;
    return { x: anchor.x - 10 + u * 28, y, z: anchor.z };
  }
  if (config.pattern === "patrol") {
    return {
      x: anchor.x + Math.sin(t * 0.45) * 14,
      y,
      z: anchor.z + Math.sin(t * 0.9) * 8,
    };
  }
  const blocker = coverPoint(config.world, anchor);
  const period = 12;
  const p = t % period;
  if (p < 4.5) {
    return { x: anchor.x + (p / 4.5) * (blocker.x - anchor.x) * 0.45, y, z: anchor.z + (p / 4.5) * (blocker.z - anchor.z) * 0.45 };
  }
  return { x: blocker.x, y: config.trackTarget === "drone" ? Math.min(y, blocker.y) : 0.35, z: blocker.z };
}

function coverPoint(world: WorldData, from: Vec3): Vec3 {
  if (world.biome === "woods" && world.trees[0]) {
    const tree = world.trees[3] ?? world.trees[0];
    return { x: tree.x + 1.2, y: 1, z: tree.z + 1.4 };
  }
  if (world.biome === "desert" && world.ridge) {
    return { x: world.ridge.x + 6, y: 1, z: world.ridge.z - world.ridge.d * 0.6 };
  }
  const b = world.buildings[2] ?? world.buildings[0];
  if (b) return { x: b.x, y: 0.4, z: b.z + b.d * 0.55 };
  return { x: from.x + 12, y: 0.4, z: from.z + 8 };
}

function opposedActors(config: RunConfig, t: number): Actor[] {
  const a = config.goals[0] ?? config.world.home;
  const b = config.goals[Math.min(1, config.goals.length - 1)] ?? { x: a.x + 18, y: 4, z: a.z + 18 };
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  return [
    { x: mx + 3.5, y: 1.2, z: mz, r: 1.7, kind: "hazard", h: 2.4 },
    { x: mx - 5, y: 1, z: mz + 4, r: 1.5, kind: "hazard", h: 2 },
    { x: mx + Math.sin(t * 0.7) * 7, y: 5, z: mz + 6, r: 1.3, kind: "drone", h: 0.6 },
    { x: mx - 8, y: 6.5, z: mz + Math.cos(t * 0.55) * 7, r: 1.3, kind: "drone", h: 0.6 },
  ];
}

interface Obs {
  kind: string;
  gap: number;
  x: number;
  z: number;
}

function nearestObs(craft: Craft, world: WorldData, actors: Actor[]): Obs {
  let best: Obs = { kind: "none", gap: 30, x: craft.x, z: craft.z };
  const consider = (kind: string, x: number, z: number, r: number, top: number) => {
    const gap = Math.max(0, Math.hypot(craft.x - x, craft.z - z) - r);
    if (gap > 16) return;
    if (craft.y > top + 2.2) return;
    if (gap < best.gap) best = { kind, gap, x, z };
  };
  for (const b of world.buildings) {
    const hx = b.w / 2;
    const hz = b.d / 2;
    const dx = Math.max(Math.abs(craft.x - b.x) - hx, 0);
    const dz = Math.max(Math.abs(craft.z - b.z) - hz, 0);
    const gap = Math.hypot(dx, dz);
    if (gap < best.gap && gap < 16 && craft.y < b.h + 1.5) best = { kind: "roof", gap, x: b.x, z: b.z };
  }
  for (const tree of world.trees) consider(tree.lethal ? "trunk" : "tree", tree.x, tree.z, tree.r, tree.trunkH);
  for (const rock of world.rocks) consider("rock", rock.x, rock.z, rock.s, rock.s);
  if (world.ridge) {
    const b = world.ridge;
    const dx = Math.max(Math.abs(craft.x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(craft.z - b.z) - b.d / 2, 0);
    const gap = Math.hypot(dx, dz);
    if (gap < best.gap && gap < 16 && craft.y < b.h + 1.2) best = { kind: "ridge", gap, x: b.x, z: b.z };
  }
  for (const w of world.wires) consider("wire", (w.ax + w.bx) / 2, (w.az + w.bz) / 2, 0.4, Math.max(w.ay, w.by));
  for (const a of actors) consider(a.kind, a.x, a.z, a.r, a.y + a.h);
  return best;
}

function canSee(craft: Craft, goal: Vec3, world: WorldData, actors: Actor[]) {
  const fx = -Math.sin(craft.yaw);
  const fz = -Math.cos(craft.yaw);
  const dx = goal.x - craft.x;
  const dz = goal.z - craft.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.8) return true;
  const dot = (dx / dist) * fx + (dz / dist) * fz;
  if (dot < 0.45) return false;
  if (blocked(craft.x, craft.y, craft.z, goal.x, goal.y + 0.2, goal.z, world, actors)) return false;
  return true;
}

function blocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number, world: WorldData, actors: Actor[]) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const dist = Math.hypot(dx, dy, dz) || 1;
  for (const tree of world.trees) {
    const hit = rayCylinder(ax, az, dx, dz, tree.x, tree.z, tree.r + 0.3, dist);
    if (hit == null) continue;
    const y = ay + dy * (hit / dist);
    if (y < tree.trunkH) return true;
  }
  for (const b of world.buildings) {
    if (rayAabb(ax, ay, az, dx, dy, dz, b.x, b.h / 2, b.z, b.w / 2, b.h / 2, b.d / 2, dist)) return true;
  }
  if (world.ridge) {
    const b = world.ridge;
    if (rayAabb(ax, ay, az, dx, dy, dz, b.x, b.y, b.z, b.w / 2, b.h / 2, b.d / 2, dist)) return true;
  }
  for (const a of actors) {
    const hit = rayCylinder(ax, az, dx, dz, a.x, a.z, a.r, dist);
    if (hit != null) {
      const y = ay + dy * (hit / dist);
      if (Math.abs(y - a.y) < a.h + 0.8) return true;
    }
  }
  return false;
}

function rayCylinder(ax: number, az: number, dx: number, dz: number, cx: number, cz: number, r: number, max: number) {
  const fx = ax - cx;
  const fz = az - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-6) return null;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  const t = t1 > 0.05 ? t1 : t2;
  if (t > 0.05 && t < 0.98) return t * max;
  return null;
}

function rayAabb(
  ax: number,
  ay: number,
  az: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  max: number,
) {
  const inv = (v: number) => (Math.abs(v) < 1e-8 ? 1e8 * Math.sign(v || 1) : 1 / v);
  const minx = cx - hx;
  const maxx = cx + hx;
  let t1 = (minx - ax) * inv(dx);
  let t2 = (maxx - ax) * inv(dx);
  let tmin = Math.min(t1, t2);
  let tmax = Math.max(t1, t2);
  t1 = (cy - hy - ay) * inv(dy);
  t2 = (cy + hy - ay) * inv(dy);
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (cz - hz - az) * inv(dz);
  t2 = (cz + hz - az) * inv(dz);
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  return tmax >= Math.max(tmin, 0.02) && tmin < 0.98 && tmin * max < max;
}

function avoidDir(dirx: number, dirz: number, craft: Craft, world: WorldData, actors: Actor[], mode: string) {
  let x = dirx;
  let z = dirz;
  const push = (ox: number, oz: number, reach: number) => {
    const dx = craft.x - ox;
    const dz = craft.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < reach && d > 0.05) {
      const s = ((reach - d) / reach) * (mode === "thread" ? 2.4 : 1.8);
      x += (dx / d) * s;
      z += (dz / d) * s;
    }
  };
  for (const tree of world.trees) push(tree.x, tree.z, tree.r + (mode === "thread" ? 4.8 : 2.2));
  for (const rock of world.rocks) push(rock.x, rock.z, rock.s + 2);
  if (world.ridge) push(world.ridge.x, world.ridge.z, 8);
  for (const a of actors) push(a.x, a.z, a.r + 3.2);
  const n = Math.hypot(x, z);
  if (n < 0.001) return { x: dirx, z: dirz };
  return { x: x / n, z: z / n };
}

function resolveBuildings(craft: Craft, world: WorldData) {
  for (const b of world.buildings) {
    if (craft.y >= b.h + 0.25) continue;
    const hx = b.w / 2 + 0.45;
    const hz = b.d / 2 + 0.45;
    const dx = craft.x - b.x;
    const dz = craft.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) craft.x += Math.sign(dx || 1) * px;
      else craft.z += Math.sign(dz || 1) * pz;
    }
  }
  if (world.ridge && craft.y < world.ridge.h + 0.3) {
    const b = world.ridge;
    const hx = b.w / 2 + 0.4;
    const hz = b.d / 2 + 0.4;
    const dx = craft.x - b.x;
    const dz = craft.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) craft.x += Math.sign(dx || 1) * px;
      else craft.z += Math.sign(dz || 1) * pz;
    }
  }
}

function resolveSolids(craft: Craft, actors: Actor[]) {
  for (const a of actors) {
    const dx = craft.x - a.x;
    const dz = craft.z - a.z;
    const d = Math.hypot(dx, dz);
    const min = a.r + 0.55;
    if (d < min && Math.abs(craft.y - a.y) < a.h + 0.8) {
      const n = d || 0.001;
      craft.x = a.x + (dx / n) * min;
      craft.z = a.z + (dz / n) * min;
    }
  }
}

function publishGps() {
  const world = live.world;
  const craft = live.craft;
  live.east = craft.x - (world?.home.x ?? 0);
  live.north = craft.z - (world?.home.z ?? 0);
  live.alt = craft.y;
  if (!world || !live.gpsOn) {
    live.lat = 0;
    live.lon = 0;
    return;
  }
  const lat = world.origin.lat + craft.z / 111320;
  const lon = world.origin.lon + craft.x / (111320 * Math.cos((world.origin.lat * Math.PI) / 180));
  live.lat = lat;
  live.lon = lon;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function wrap(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function sampleGoals(world: WorldData, modeKind: string, user: Vec3[], anchor: Vec3 | null): Vec3[] {
  if (modeKind === "track") return [];
  if (user.length) return user.map((p) => ({ ...p }));
  if (modeKind === "thread" && world.thread.length) return world.thread.map((p) => ({ ...p }));
  return world.sample.map((p) => ({ ...p }));
}

export function installProbe() {
  if (typeof window === "undefined") return;
  window.__controlsTest = {
    getYaw: () => live.craft.yaw,
    getSpeed: () => Math.hypot(live.craft.vx, live.craft.vz),
    setKeys: (codes: string[]) => {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    setSteer: (v: number) => {
      live.steerOverride = v;
    },
  };
  window.__moka = {
    ready: true,
    phase: () => live.command,
    status: () => live.status,
    pilot: () => live.pilotLabel,
    rows: () => live.rows.length,
    fail: () => live.failReason,
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
    __moka?: {
      ready: boolean;
      phase: () => string;
      status: () => string;
      pilot: () => string;
      rows: () => number;
      fail: () => string;
    };
  }
}

export function worldFor(map: { id: string; biome?: string; home_pad?: WorldData["home"]; origin?: { lat: number; lon: number } }) {
  return buildWorld(map);
}
