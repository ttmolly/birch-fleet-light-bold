import { answerFromLogits, type TinyNet } from "./tiny-net.ts";
import { FEAT, OUT, featuresOf, type PilotAnswer } from "./text.ts";

function varint(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  while (v > 127) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u8(nums: number[]) {
  return new Uint8Array(nums);
}

function key(field: number, wire: number) {
  return u8(varint((field << 3) | wire));
}

function bytesField(field: number, data: Uint8Array) {
  return concat([key(field, 2), u8(varint(data.length)), data]);
}

function strField(field: number, s: string) {
  return bytesField(field, new TextEncoder().encode(s));
}

function varField(field: number, n: number) {
  return concat([key(field, 0), u8(varint(n))]);
}

function f32bytes(arr: ArrayLike<number>) {
  const buf = new Uint8Array(arr.length * 4);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < arr.length; i++) view.setFloat32(i * 4, arr[i] ?? 0, true);
  return buf;
}

function tensor(name: string, dims: number[], data: ArrayLike<number>) {
  const parts: Uint8Array[] = [];
  for (const d of dims) parts.push(varField(1, d));
  parts.push(varField(2, 1));
  parts.push(strField(8, name));
  parts.push(bytesField(9, f32bytes(data)));
  return concat(parts);
}

function tensorShape(dims: number[]) {
  const dimsMsg = dims.map((d) => bytesField(1, varField(1, d)));
  return bytesField(2, concat(dimsMsg));
}

function valueInfo(name: string, dims: number[]) {
  const tensorType = concat([varField(1, 1), tensorShape(dims)]);
  const type = bytesField(1, tensorType);
  return concat([strField(1, name), bytesField(2, type)]);
}

function node(op: string, inputs: string[], outputs: string[]) {
  const parts: Uint8Array[] = [];
  for (const i of inputs) parts.push(strField(1, i));
  for (const o of outputs) parts.push(strField(2, o));
  parts.push(strField(4, op));
  return concat(parts);
}

export function netToOnnx(net: TinyNet): Uint8Array {
  const inits: Uint8Array[] = [];
  const nodes: Uint8Array[] = [];
  let prev = "state";
  net.layers.forEach((L, i) => {
    const wn = `W${i}`;
    const bn = `B${i}`;
    inits.push(bytesField(5, tensor(wn, [L.din, L.dout], L.w)));
    inits.push(bytesField(5, tensor(bn, [L.dout], L.b)));
    const mm = `mm${i}`;
    const ad = `ad${i}`;
    nodes.push(bytesField(1, node("MatMul", [prev, wn], [mm])));
    const last = i === net.layers.length - 1;
    const added = last ? "logits" : ad;
    nodes.push(bytesField(1, node("Add", [mm, bn], [added])));
    if (!last) {
      const rel = `h${i}`;
      nodes.push(bytesField(1, node("Relu", [added], [rel])));
      prev = rel;
    }
  });
  const graphParts = [
    ...nodes,
    strField(2, "moka-tiny"),
    ...inits,
    bytesField(11, valueInfo("state", [1, FEAT])),
    bytesField(12, valueInfo("logits", [1, OUT])),
  ];
  const graph = concat(graphParts);
  const opset = concat([strField(1, ""), varField(2, 13)]);
  return concat([
    varField(1, 8),
    strField(2, "moka-tiny"),
    bytesField(7, graph),
    bytesField(8, opset),
  ]);
}

type PBVal = number | Uint8Array;

function readVarint(buf: Uint8Array, p: number): [number, number] {
  let shift = 0;
  let n = 0;
  while (p < buf.length) {
    const b = buf[p] ?? 0;
    p += 1;
    n |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [n >>> 0, p];
    shift += 7;
    if (shift > 28) break;
  }
  throw new Error("bad varint");
}

function readFields(buf: Uint8Array): Map<number, PBVal[]> {
  const map = new Map<number, PBVal[]>();
  let p = 0;
  while (p < buf.length) {
    const [k, p1] = readVarint(buf, p);
    p = p1;
    const field = k >>> 3;
    const wire = k & 7;
    let val: PBVal;
    if (wire === 0) {
      const [v, p2] = readVarint(buf, p);
      p = p2;
      val = v;
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, p);
      p = p2;
      val = buf.subarray(p, p + len);
      p += len;
    } else if (wire === 5) {
      p += 4;
      val = 0;
    } else if (wire === 1) {
      p += 8;
      val = 0;
    } else {
      throw new Error("onnx wire");
    }
    const list = map.get(field) ?? [];
    list.push(val);
    map.set(field, list);
  }
  return map;
}

function asBytes(v: PBVal | undefined): Uint8Array {
  if (v instanceof Uint8Array) return v;
  throw new Error("expected bytes");
}

function utf8(b: Uint8Array) {
  return new TextDecoder().decode(b);
}

interface Tensor {
  name: string;
  dims: number[];
  data: Float32Array;
}

function parseTensor(buf: Uint8Array): Tensor {
  const f = readFields(buf);
  const dims = (f.get(1) ?? []).map((v) => (typeof v === "number" ? v : 0));
  const name = utf8(asBytes((f.get(8) ?? [])[0]));
  const raw = asBytes((f.get(9) ?? [])[0]);
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  const data = new Float32Array(copy.buffer);
  return { name, dims, data };
}

interface OnnxNode {
  op: string;
  inputs: string[];
  outputs: string[];
}

function parseNode(buf: Uint8Array): OnnxNode {
  const f = readFields(buf);
  const inputs = (f.get(1) ?? []).map((v) => utf8(asBytes(v)));
  const outputs = (f.get(2) ?? []).map((v) => utf8(asBytes(v)));
  const op = utf8(asBytes((f.get(4) ?? [])[0]));
  return { op, inputs, outputs };
}

export interface LoadedNet {
  forward(x: Float32Array): Float32Array;
}

export function parseOnnx(bytes: Uint8Array): LoadedNet {
  const model = readFields(bytes);
  const graphBytes = asBytes((model.get(7) ?? [])[0]);
  const graph = readFields(graphBytes);
  const tensors = new Map<string, Tensor>();
  for (const init of graph.get(5) ?? []) {
    const t = parseTensor(asBytes(init));
    tensors.set(t.name, t);
  }
  const nodes = (graph.get(1) ?? []).map((n) => parseNode(asBytes(n)));
  if (nodes.length < 4) throw new Error("not moka-tiny");

  return {
    forward(x: Float32Array) {
      const env = new Map<string, Float32Array>();
      env.set("state", x);
      for (const t of tensors.values()) env.set(t.name, t.data);
      const shape = new Map<string, number[]>();
      shape.set("state", [1, x.length]);
      for (const t of tensors.values()) shape.set(t.name, t.dims);
      for (const n of nodes) {
        if (n.op === "MatMul") {
          const a = env.get(n.inputs[0] ?? "");
          const b = env.get(n.inputs[1] ?? "");
          const ad = shape.get(n.inputs[0] ?? "") ?? [1, a?.length ?? 0];
          const bd = shape.get(n.inputs[1] ?? "") ?? [];
          if (!a || !b) throw new Error("matmul");
          const rows = ad[0] ?? 1;
          const k = ad[1] ?? a.length;
          const cols = bd[1] ?? bd[0] ?? b.length / k;
          const y = new Float32Array(rows * cols);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              let s = 0;
              for (let t = 0; t < k; t++) s += (a[r * k + t] ?? 0) * (b[t * cols + c] ?? 0);
              y[r * cols + c] = s;
            }
          }
          const out = n.outputs[0] ?? "";
          env.set(out, y);
          shape.set(out, [rows, cols]);
        } else if (n.op === "Add") {
          const a = env.get(n.inputs[0] ?? "");
          const b = env.get(n.inputs[1] ?? "");
          if (!a || !b) throw new Error("add");
          const y = new Float32Array(a.length);
          for (let i = 0; i < a.length; i++) y[i] = (a[i] ?? 0) + (b[i % b.length] ?? 0);
          const out = n.outputs[0] ?? "";
          env.set(out, y);
          shape.set(out, shape.get(n.inputs[0] ?? "") ?? [1, a.length]);
        } else if (n.op === "Relu") {
          const a = env.get(n.inputs[0] ?? "");
          if (!a) throw new Error("relu");
          const y = new Float32Array(a.length);
          for (let i = 0; i < a.length; i++) y[i] = Math.max(0, a[i] ?? 0);
          const out = n.outputs[0] ?? "";
          env.set(out, y);
          shape.set(out, shape.get(n.inputs[0] ?? "") ?? [1, a.length]);
        } else {
          throw new Error(`op ${n.op}`);
        }
      }
      const logits = env.get("logits");
      if (!logits || logits.length < OUT) throw new Error("no logits");
      return logits;
    },
  };
}

export function inferOnnx(bytes: Uint8Array, text: string, blindDistance = false): PilotAnswer {
  const x64 = featuresOf(text, blindDistance);
  const x = new Float32Array(x64.length);
  for (let i = 0; i < x64.length; i++) x[i] = x64[i] ?? 0;
  const net = parseOnnx(bytes);
  const logits64 = new Float64Array(net.forward(x));
  return answerFromLogits(logits64);
}
