export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tint: number;
}

export interface Tree {
  x: number;
  z: number;
  trunkH: number;
  r: number;
  canopy: number;
  lethal: boolean;
}

export interface WorldData {
  id: string;
  biome: string;
  home: Vec3;
  origin: { lat: number; lon: number };
  cruise: number;
  fence: number;
  sky: number;
  fog: number;
  ground: number;
  accent: number;
  buildings: Box[];
  trees: Tree[];
  rocks: { x: number; z: number; s: number }[];
  ridge: Box | null;
  wires: { ax: number; ay: number; az: number; bx: number; by: number; bz: number }[];
  streamZ: number | null;
  park: { x: number; z: number; w: number; d: number } | null;
  sample: Vec3[];
  thread: Vec3[];
}

export interface MapManifest {
  id: string;
  bird?: string;
  biome?: string;
  home_pad?: { x?: number; y?: number; z?: number; label?: string };
  origin?: { lat?: number; lon?: number };
  enabled?: boolean;
}

function homeOf(map: MapManifest, fallback: Vec3): Vec3 {
  const h = map.home_pad;
  if (!h) return fallback;
  return {
    x: typeof h.x === "number" ? h.x : fallback.x,
    y: typeof h.y === "number" ? h.y : fallback.y,
    z: typeof h.z === "number" ? h.z : fallback.z,
  };
}

export function buildWorld(map: MapManifest): WorldData {
  const biome = map.biome ?? "flat";
  const origin = {
    lat: map.origin?.lat ?? 0,
    lon: map.origin?.lon ?? 0,
  };
  if (biome === "city") return city(map, origin);
  if (biome === "woods") return woods(map, origin);
  if (biome === "desert") return desert(map, origin);
  const home = homeOf(map, { x: 0, y: 0.25, z: 0 });
  return {
    id: map.id,
    biome,
    home,
    origin,
    cruise: 8,
    fence: 70,
    sky: 0x243028,
    fog: 0x1a221c,
    ground: 0x2a3328,
    accent: 0xd6f25a,
    buildings: [],
    trees: [],
    rocks: [],
    ridge: null,
    wires: [],
    streamZ: null,
    park: null,
    sample: [
      { x: home.x, y: 6, z: home.z + 18 },
      { x: home.x + 16, y: 6, z: home.z + 34 },
      { x: home.x + 16, y: home.y, z: home.z + 46 },
    ],
    thread: [],
  };
}

function city(map: MapManifest, origin: { lat: number; lon: number }): WorldData {
  const home = homeOf(map, { x: 0, y: 12, z: 0 });
  const buildings: Box[] = [
    { x: home.x, y: home.y / 2, z: home.z, w: 16, h: home.y, d: 16, tint: 0x46586a },
  ];
  const specs: [number, number, number, number, number][] = [
    [-30, -26, 14, 9, 12],
    [-32, 6, 12, 11, 14],
    [-26, 32, 13, 7, 11],
    [4, -30, 15, 8, 13],
    [2, 30, 12, 10, 12],
    [30, 8, 14, 12, 13],
    [32, 32, 11, 8, 12],
    [-50, -8, 10, 13, 11],
    [50, -12, 12, 9, 12],
    [18, -48, 11, 7, 10],
  ];
  for (const [x, z, w, h, d] of specs) {
    buildings.push({
      x,
      y: h / 2,
      z,
      w,
      h,
      d,
      tint: (0x314152 + (Math.abs(x * 3 + z) % 18) * 0x040404) & 0xffffff,
    });
  }
  const wires = [
    wire(home.x, home.y + 0.4, home.z, -30, 9.4, -26),
    wire(-30, 9.4, -26, -32, 11.4, 6),
    wire(home.x, home.y + 0.4, home.z, 4, 8.4, -30),
    wire(30, 12.4, 8, 32, 8.4, 32),
    wire(-32, 11.4, 6, -26, 7.4, 32),
  ];
  const trees: Tree[] = [
    { x: 40, z: -34, trunkH: 3.2, r: 0.18, canopy: 1.6, lethal: false },
    { x: 34, z: -40, trunkH: 2.8, r: 0.16, canopy: 1.5, lethal: false },
    { x: 46, z: -28, trunkH: 3.4, r: 0.18, canopy: 1.7, lethal: false },
  ];
  return {
    id: map.id,
    biome: "city",
    home,
    origin,
    cruise: 16,
    fence: 72,
    sky: 0x1b2836,
    fog: 0x243244,
    ground: 0x1a1e24,
    accent: 0xd6f25a,
    buildings,
    trees,
    rocks: [],
    ridge: null,
    wires,
    streamZ: null,
    park: { x: 40, z: -36, w: 24, d: 22 },
    sample: [
      { x: home.x, y: 16, z: home.z + 22 },
      { x: -16, y: 16, z: 26 },
      { x: 22, y: 8, z: 8 },
      { x: 40, y: 2, z: -30 },
    ],
    thread: [
      { x: home.x, y: 14, z: home.z + 16 },
      { x: 16, y: 12, z: 20 },
    ],
  };
}

function woods(map: MapManifest, origin: { lat: number; lon: number }): WorldData {
  const home = homeOf(map, { x: 0, y: 0.2, z: 0 });
  const trees: Tree[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if (i === 0 && j === 0) continue;
      const x = i * 18 + ((i * 5 + j * 3) % 5) - 2;
      const z = j * 18 + ((j * 4 + i * 2) % 5) - 2;
      if (Math.hypot(x - home.x, z - home.z) < 13) continue;
      if (Math.abs(z - 26) < 3.2) continue;
      trees.push({
        x,
        z,
        trunkH: 12 + ((Math.abs(i * 3 + j) % 4) as number),
        r: 0.42,
        canopy: 3.1,
        lethal: true,
      });
    }
  }
  const thread: Vec3[] = [];
  const gates = [
    { x: 8, z: 16 },
    { x: -6, z: 34 },
    { x: 14, z: 46 },
    { x: -16, z: 18 },
  ];
  for (const g of gates) {
    let ok = true;
    for (const t of trees) {
      if (Math.hypot(g.x - t.x, g.z - t.z) < t.r + 2.4) ok = false;
    }
    if (ok) thread.push({ x: g.x, y: 6.2, z: g.z });
  }
  if (thread.length < 2) {
    thread.push({ x: 20, y: 6.2, z: 20 }, { x: -20, y: 6.2, z: 36 });
  }
  return {
    id: map.id,
    biome: "woods",
    home,
    origin,
    cruise: 6.4,
    fence: 70,
    sky: 0x1a2c24,
    fog: 0x24362c,
    ground: 0x1c2a20,
    accent: 0xd6f25a,
    buildings: [],
    trees,
    rocks: [
      { x: 22, z: -8, s: 1.1 },
      { x: -18, z: 8, s: 0.8 },
    ],
    ridge: null,
    wires: [],
    streamZ: 26,
    park: null,
    sample: [
      { x: 10, y: 6, z: 14 },
      { x: -4, y: 6, z: 32 },
      { x: 12, y: 5, z: 44 },
    ],
    thread,
  };
}

function desert(map: MapManifest, origin: { lat: number; lon: number }): WorldData {
  const home = homeOf(map, { x: 0, y: 0.25, z: 18 });
  return {
    id: map.id,
    biome: "desert",
    home,
    origin,
    cruise: 8,
    fence: 78,
    sky: 0xe6c79a,
    fog: 0xd7b48a,
    ground: 0xc9a36e,
    accent: 0xd6f25a,
    buildings: [],
    trees: [],
    rocks: [
      { x: -16, z: 6, s: 1.4 },
      { x: 14, z: -2, s: 1.1 },
      { x: 22, z: 24, s: 0.9 },
      { x: -24, z: 28, s: 1.6 },
      { x: 8, z: -18, s: 1.2 },
      { x: -8, z: -36, s: 1.5 },
      { x: 30, z: -30, s: 1 },
    ],
    ridge: { x: 0, y: 4, z: -30, w: 70, h: 8, d: 12, tint: 0xb08968 },
    wires: [],
    streamZ: null,
    park: null,
    sample: [
      { x: 0, y: 7, z: 4 },
      { x: 26, y: 8, z: -8 },
      { x: 28, y: 7, z: -42 },
      { x: -18, y: 0.4, z: 8 },
    ],
    thread: [
      { x: 10, y: 6, z: 0 },
      { x: 24, y: 6, z: -16 },
    ],
  };
}

function wire(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  return { ax, ay, az, bx, by, bz };
}
