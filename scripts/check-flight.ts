import { arm, keys, live, tick } from "../src/lib/sim/flight.ts";
import { buildWorld } from "../src/lib/sim/world.ts";
import { rulesAnswer } from "../src/lib/moka/text.ts";

const world = buildWorld({
  id: "corvid",
  bird: "Corvid",
  biome: "city",
  home_pad: { x: 0, y: 12, z: 0, label: "rooftop" },
  origin: { lat: 51.2277, lon: 6.7735 },
  enabled: true,
});
const ask = (text: string) => ({ ...rulesAnswer(text), source: "rules" as const, label: "rules" });
arm({
  mapId: "corvid",
  modeKind: "waypoints",
  world,
  goals: world.sample,
  trackTarget: "marker",
  pattern: "shuttle",
  anchor: null,
  ask,
});
for (let i = 0; i < 120; i++) tick(1 / 60);
const speed = Math.hypot(live.craft.vx, live.craft.vz);
if (speed < 1) throw new Error("did not fly, speed " + speed.toFixed(2));
if (live.craft.z <= world.home.z + 1) throw new Error("did not move north");
const y0 = live.craft.yaw;
keys.clear();
keys.add("KeyW");
keys.add("KeyA");
for (let i = 0; i < 40; i++) tick(1 / 60);
let dy = live.craft.yaw - y0;
while (dy > Math.PI) dy -= Math.PI * 2;
while (dy < -Math.PI) dy += Math.PI * 2;
if (dy < 0.05) throw new Error("A did not turn left (+yaw), d=" + dy.toFixed(3));
keys.clear();
console.log("flight ok", "speed", speed.toFixed(2), "yaw+", dy.toFixed(2), "phase", live.command, "z", live.craft.z.toFixed(1));
