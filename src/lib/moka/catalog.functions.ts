import { createServerFn } from "@tanstack/react-start";
import { bundledCatalog } from "./bundled.ts";
import type { Catalog, ModelManifest } from "./types.ts";

const GROUPS = ["hardware", "drones", "maps", "modes", "models"] as const;

function safeId(id: string) {
  return /^[a-z0-9][a-z0-9-]{0,48}$/.test(id);
}

export const getCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<Catalog> => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = process.cwd();
  const readGroup = async (folder: string) => {
    const base = path.join(root, folder);
    let names: string[] = [];
    try {
      names = await fs.readdir(base);
    } catch {
      return [];
    }
    const items = [];
    for (const name of names) {
      try {
        const dir = path.join(base, name);
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) continue;
        const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
        const manifest = JSON.parse(raw) as Record<string, unknown>;
        if (folder === "models") {
          items.push(await decorateModel(fs, path, dir, manifest));
        } else {
          items.push(manifest);
        }
      } catch {
        /* skip a broken folder */
      }
    }
    return items;
  };
  const [hardware, drones, maps, modes, models] = await Promise.all(GROUPS.map((g) => readGroup(g)));
  const disk = {
    hardware: hardware as unknown as Catalog["hardware"],
    drones: drones as unknown as Catalog["drones"],
    maps: maps as unknown as Catalog["maps"],
    modes: modes as unknown as Catalog["modes"],
    models: models as unknown as Catalog["models"],
  };
  return mergeCatalog(bundledCatalog(), disk);
});

function mergeCatalog(base: Catalog, extra: Catalog): Catalog {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((item) => [item.id, item]));
    for (const item of b) map.set(item.id, item);
    return [...map.values()];
  };
  return {
    hardware: byId(base.hardware, extra.hardware),
    drones: byId(base.drones, extra.drones),
    maps: byId(base.maps, extra.maps),
    modes: byId(base.modes, extra.modes),
    models: byId(base.models, extra.models),
  };
}

async function decorateModel(
  fs: typeof import("node:fs/promises"),
  path: typeof import("node:path"),
  dir: string,
  manifest: Record<string, unknown>,
): Promise<ModelManifest> {
  const id = String(manifest.id ?? path.basename(dir));
  const kind = String(manifest.kind ?? "student");
  let configKind = kind;
  let configFound = false;
  try {
    const cfg = JSON.parse(await fs.readFile(path.join(dir, "moka_config.json"), "utf8")) as { kind?: string };
    configFound = true;
    if (cfg.kind) configKind = cfg.kind;
  } catch {
    /* no config */
  }
  const onnxPath = path.join(dir, "model.onnx");
  let size = 0;
  try {
    size = (await fs.stat(onnxPath)).size;
  } catch {
    size = 0;
  }
  const has = size > 0;
  const tooBig = size > 1_500_000;
  const laya = configKind === "laya" || kind === "laya" || id === "typed";
  let modelBase64: string | undefined;
  if (has && !tooBig && !laya && kind !== "rules") {
    const buf = await fs.readFile(onnxPath);
    modelBase64 = Buffer.from(buf).toString("base64");
  }
  const enabled = laya ? has || configFound : kind === "rules" ? manifest.enabled !== false : Boolean(manifest.enabled) && has && !tooBig;
  const note = typeof manifest.note === "string" ? manifest.note : undefined;
  const badge = laya
    ? has || configFound
      ? "not a flight pilot"
      : "no bundle"
    : tooBig
      ? "not a flight pilot"
      : note && note.length < 48
        ? note
        : undefined;
  return {
    id,
    name: String(manifest.name ?? id),
    kind: laya ? "laya" : kind,
    trained_on: String(manifest.trained_on ?? ""),
    enabled,
    note,
    flight: kind === "rules" || (has && !tooBig && !laya),
    badge,
    loss: typeof manifest.loss === "number" ? manifest.loss : undefined,
    gates: Array.isArray(manifest.gates) ? (manifest.gates as ModelManifest["gates"]) : undefined,
    modelBase64,
  };
}

export interface SaveBundle {
  id: string;
  manifest: ModelManifest;
  onnxBase64: string;
  tokenizer: string;
  config: string;
}

export const saveModelBundle = createServerFn({ method: "POST" })
  .validator((data: SaveBundle) => {
    if (!data || !safeId(data.id)) throw new Error("Model id must be a short slug.");
    if (!data.onnxBase64 || data.onnxBase64.length > 2_000_000) throw new Error("ONNX bundle is missing or too large.");
    return data;
  })
  .handler(async ({ data }) => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "models", data.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "model.onnx"), Buffer.from(data.onnxBase64, "base64"));
    await fs.writeFile(path.join(dir, "tokenizer.json"), data.tokenizer);
    await fs.writeFile(path.join(dir, "moka_config.json"), data.config);
    const manifest = {
      id: data.id,
      name: data.manifest.name,
      kind: data.manifest.kind,
      trained_on: data.manifest.trained_on,
      enabled: true,
      note: data.manifest.note,
      loss: data.manifest.loss,
      gates: data.manifest.gates,
    };
    await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    return { ok: true as const, path: `models/${data.id}` };
  });

export interface AddedBundle {
  id: string;
  files: { name: string; base64: string }[];
}

export const addModelFolder = createServerFn({ method: "POST" })
  .validator((data: AddedBundle) => {
    if (!data || !safeId(data.id)) throw new Error("Model id must be a short slug.");
    if (!Array.isArray(data.files) || data.files.length === 0) throw new Error("Folder is empty.");
    return data;
  })
  .handler(async ({ data }) => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "models", data.id);
    await fs.mkdir(dir, { recursive: true });
    for (const file of data.files) {
      const base = path.basename(file.name);
      if (!base || base === "." || base === "..") continue;
      if (file.base64.length > 2_000_000) continue;
      await fs.writeFile(path.join(dir, base), Buffer.from(file.base64, "base64"));
    }
    return { ok: true as const, path: `models/${data.id}` };
  });
