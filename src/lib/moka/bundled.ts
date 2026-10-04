import type { Catalog, DroneManifest, HardwareManifest, MapManifest, ModeManifest, ModelManifest } from "./types.ts";
import mokaFlightUrl from "../../../models/moka-flight/model.onnx?url";

const hardware = import.meta.glob("../../../hardware/*/manifest.json", { eager: true, import: "default" }) as Record<
  string,
  HardwareManifest
>;
const drones = import.meta.glob("../../../drones/*/manifest.json", { eager: true, import: "default" }) as Record<
  string,
  DroneManifest
>;
const maps = import.meta.glob("../../../maps/*/manifest.json", { eager: true, import: "default" }) as Record<
  string,
  MapManifest
>;
const modes = import.meta.glob("../../../modes/*/manifest.json", { eager: true, import: "default" }) as Record<
  string,
  ModeManifest
>;
const models = import.meta.glob("../../../models/*/manifest.json", { eager: true, import: "default" }) as Record<
  string,
  ModelManifest
>;

export function bundledCatalog(): Catalog {
  return {
    hardware: Object.values(hardware),
    drones: Object.values(drones),
    maps: Object.values(maps),
    modes: Object.values(modes),
    models: Object.values(models).map((model) => ({
      ...model,
      flight: model.kind === "rules" || model.kind === "student",
      badge: model.kind === "laya" ? "no bundle" : model.note && model.note.length < 48 ? model.note : undefined,
      enabled: model.kind === "laya" ? false : model.enabled !== false,
    })),
  };
}

export function flightWeightUrl(id: string) {
  return id === "moka-flight" ? mokaFlightUrl : null;
}
