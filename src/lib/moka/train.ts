import { curriculumRows, trainingTexts, type RowMark } from "./curriculum.ts";
import { saveModelBundle } from "./catalog.functions.ts";
import { bytesToBase64 } from "./pilot.ts";
import { netToOnnx, inferOnnx } from "./onnx.ts";
import { gatesPass, runGates, trainStudent, type GateHit } from "./tiny-net.ts";
import type { ModelManifest } from "./types.ts";

export interface TrainReport {
  name: string;
  id: string;
  loss: number;
  gates: GateHit[];
  passed: boolean;
  savedPath?: string;
  rows: number;
  model?: ModelManifest;
}

function slug(name: string) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || "moka-beam";
}

export function rowCount(recorded: RowMark[]) {
  return trainingTexts(recorded).length;
}

export async function trainStudentBundle(opts: {
  name: string;
  mapId: string;
  recorded: RowMark[];
  taken: string[];
}): Promise<TrainReport> {
  const recorded = opts.recorded;
  const texts = trainingTexts(recorded);
  if (texts.length < 300) {
    throw new Error(`Need a few hundred rows before a train. Have ${texts.length}.`);
  }
  await yieldPaint();
  let base = slug(opts.name);
  let id = base;
  let n = 2;
  const taken = new Set(opts.taken);
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  const trained = trainStudent(texts, { steps: 260, seed: (Date.now() % 9000) + 2, lr: 0.045, batch: 72 });
  const onnx = netToOnnx(trained.net);
  const hits = runGates((text) => inferOnnx(onnx, text, false).phase);
  const passed = gatesPass(hits);
  const manifest: ModelManifest = {
    id,
    name: opts.name.trim() || id,
    kind: "student",
    trained_on: `${opts.mapId} + rules teacher`,
    enabled: passed,
    note: passed ? "trained in the sim" : "failed gates",
    flight: passed,
    failed: !passed,
    loss: trained.loss,
    gates: hits,
    modelBase64: passed ? bytesToBase64(onnx) : undefined,
  };
  let savedPath: string | undefined;
  if (passed) {
    const saved = await saveModelBundle({
      data: {
        id,
        manifest,
        onnxBase64: bytesToBase64(onnx),
        tokenizer: JSON.stringify(
          {
            type: "moka-tiny-v1",
            features: 16,
            note: "Whitespace state text into 16 features, then four linear layers.",
          },
          null,
          2,
        ),
        config: JSON.stringify(
          {
            id,
            name: manifest.name,
            kind: "student",
            arch: "moka-tiny",
            layers: 4,
            trained_on: manifest.trained_on,
          },
          null,
          2,
        ),
      },
    });
    savedPath = saved.path;
  }
  return {
    name: manifest.name,
    id,
    loss: trained.loss,
    gates: hits,
    passed,
    savedPath,
    rows: texts.length,
    model: manifest,
  };
}

export function curriculumSize() {
  return curriculumRows().length;
}

function yieldPaint() {
  return new Promise((resolve) => setTimeout(resolve, 40));
}
