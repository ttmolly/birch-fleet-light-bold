export interface HardwareManifest {
  id: string;
  name: string;
  ram_gb: number;
  enabled: boolean;
}

export interface DroneManifest {
  id: string;
  name: string;
  kind: string;
  camera: string;
  enabled: boolean;
}

export interface MapManifest {
  id: string;
  bird: string;
  biome: string;
  home_pad: { x: number; y: number; z: number; label?: string };
  origin: { lat: number; lon: number };
  enabled: boolean;
}

export interface ModeManifest {
  id: string;
  name: string;
  kind: string;
  summary: string;
  enabled: boolean;
}

export interface ModelManifest {
  id: string;
  name: string;
  kind: "rules" | "student" | "laya" | string;
  trained_on: string;
  enabled: boolean;
  note?: string;
  flight?: boolean;
  badge?: string;
  modelBase64?: string;
  failed?: boolean;
  loss?: number;
  gates?: { name: string; expect: string; got: string; pass: boolean }[];
}

export interface Catalog {
  hardware: HardwareManifest[];
  drones: DroneManifest[];
  maps: MapManifest[];
  modes: ModeManifest[];
  models: ModelManifest[];
}
