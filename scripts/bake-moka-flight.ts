import { writeFileSync, mkdirSync } from "node:fs";
import { curriculumRows } from "../src/lib/moka/curriculum.ts";
import { inferOnnx, netToOnnx } from "../src/lib/moka/onnx.ts";
import { gatesPass, runGates, trainStudent, weakDistanceNet } from "../src/lib/moka/tiny-net.ts";
import { GATES, rulesAnswer } from "../src/lib/moka/text.ts";

for (const g of GATES) {
  const got = rulesAnswer(g.text).phase;
  if (got !== g.expect) {
    throw new Error(`rules miss ${g.name}: ${got} != ${g.expect}`);
  }
}

const texts = curriculumRows().map((r) => r.text);
if (texts.length < 300) throw new Error(`curriculum short: ${texts.length}`);

const trained = trainStudent(texts, { steps: 280, seed: 3, lr: 0.045, batch: 72 });
const onnx = netToOnnx(trained.net);
const hits = runGates((text) => inferOnnx(onnx, text, false).phase);
console.log(
  "student",
  trained.loss.toFixed(3),
  hits.map((h) => `${h.name}:${h.got}${h.pass ? "" : "!"}`).join(" "),
);
if (!gatesPass(hits)) throw new Error("student gates failed");

const blind = { net: weakDistanceNet(), loss: 0 };
const blindOnnx = netToOnnx(blind.net);
const blindHits = runGates((text) => inferOnnx(blindOnnx, text, false).phase);
console.log(
  "moka-flight",
  blindHits.map((h) => `${h.name}:${h.got}`).join(" "),
);
if (blindHits.find((h) => h.name === "distance 4")?.got !== "enroute") {
  throw new Error("moka-flight was not weak on distance");
}
if (blindHits.find((h) => h.name === "over the pad")?.got !== "land") {
  throw new Error("moka-flight missed the pad");
}

mkdirSync("models/moka-flight", { recursive: true });
writeFileSync("models/moka-flight/model.onnx", blindOnnx);
writeFileSync(
  "models/moka-flight/tokenizer.json",
  JSON.stringify(
    {
      type: "moka-tiny-v1",
      features: 16,
      note: "Whitespace state text. Distance, altitude, battery, gps, obstacle, gap, target, and over pad are binned into 16 numbers. Four linear layers. Not a BPE tokenizer.",
    },
    null,
    2,
  ),
);
writeFileSync(
  "models/moka-flight/moka_config.json",
  JSON.stringify(
    {
      id: "moka-flight",
      name: "moka-flight",
      kind: "student",
      arch: "moka-tiny",
      layers: 4,
      trained_on: "shipped student, distance weights held at zero",
      note: "weak on distance",
      blind_distance: false,
    },
    null,
    2,
  ),
);
console.log("wrote models/moka-flight", blindOnnx.byteLength, "bytes", "rows", texts.length);
