import { answerFromLogits } from "./tiny-net.ts";
import { flightWeightUrl } from "./bundled.ts";
import { parseOnnx } from "./onnx.ts";
import { featuresOf, rulesAnswer, type PilotAnswer } from "./text.ts";
import type { ModelManifest } from "./types.ts";

export interface AskResult extends PilotAnswer {
  source: "rules" | "moka" | "fallback" | "laya";
  label: string;
}

export async function hydrateModel(model: ModelManifest): Promise<ModelManifest> {
  if (model.modelBase64 || model.kind !== "student") return model;
  const url = flightWeightUrl(model.id);
  if (!url) return model;
  const res = await fetch(url);
  if (!res.ok) return model;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { ...model, modelBase64: bytesToBase64(bytes), flight: true };
}

export function pilotFor(model: ModelManifest | undefined): (text: string) => AskResult {
  if (!model || model.kind === "rules" || model.id === "rules") {
    return (text) => ({ ...rulesAnswer(text), source: "rules", label: "rules" });
  }
  if (model.kind === "laya" || model.flight === false && model.kind !== "student") {
    return (text) => ({ ...rulesAnswer(text), source: "laya", label: "not a flight pilot" });
  }
  const bytes = decode(model.modelBase64);
  if (!bytes) {
    return (text) => ({ ...rulesAnswer(text), source: "fallback", label: "rules, not moka" });
  }
  try {
    const net = parseOnnx(bytes);
    const weak = (model.note ?? "").toLowerCase().includes("weak") || model.id === "moka-flight";
    const label = weak ? `${model.name} · weak on distance` : model.name;
    return (text) => {
      try {
        const x64 = featuresOf(text, false);
        const x = new Float32Array(x64.length);
        for (let i = 0; i < x64.length; i++) x[i] = x64[i] ?? 0;
        const logits = net.forward(x);
        const ans = answerFromLogits(Float64Array.from(logits));
        return { ...ans, source: "moka", label };
      } catch {
        return { ...rulesAnswer(text), source: "fallback", label: "rules, not moka" };
      }
    };
  } catch {
    return (text) => ({ ...rulesAnswer(text), source: "fallback", label: "rules, not moka" });
  }
}

function decode(b64: string | undefined) {
  if (!b64 || typeof atob !== "function") return null;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
