import {
  CLEARANCES,
  FEAT,
  GATES,
  OUT,
  PHASES,
  clearanceIndex,
  featuresOf,
  phaseIndex,
  rulesAnswer,
  type Phase,
  type PilotAnswer,
} from "./text.ts";

export interface Layer {
  w: Float64Array;
  b: Float64Array;
  din: number;
  dout: number;
}

export interface TinyNet {
  layers: Layer[];
  blindDistance: boolean;
}

const SHAPE = [
  [FEAT, 32],
  [32, 32],
  [32, 32],
  [32, OUT],
] as const;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng: () => number) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

export function createNet(seed = 7, blindDistance = false): TinyNet {
  const rng = mulberry32(seed);
  const layers: Layer[] = SHAPE.map(([din, dout]) => {
    const scale = Math.sqrt(2 / din);
    const w = new Float64Array(din * dout);
    for (let i = 0; i < w.length; i++) w[i] = randn(rng) * scale * 0.6;
    return { w, b: new Float64Array(dout), din, dout };
  });
  return { layers, blindDistance };
}

function softmaxSlice(logits: Float64Array, start: number, end: number) {
  let m = -Infinity;
  for (let i = start; i < end; i++) m = Math.max(m, logits[i] ?? 0);
  const p = new Float64Array(end - start);
  let sum = 0;
  for (let i = start; i < end; i++) {
    const e = Math.exp((logits[i] ?? 0) - m);
    p[i - start] = e;
    sum += e;
  }
  for (let i = 0; i < p.length; i++) p[i] = (p[i] ?? 0) / (sum || 1);
  return p;
}

export function answerFromLogits(logits: Float64Array, confidenceFloor = 0): PilotAnswer {
  const phaseP = softmaxSlice(logits, 0, 5);
  const threatP = softmaxSlice(logits, 5, 7);
  const seeP = softmaxSlice(logits, 7, 9);
  const clearP = softmaxSlice(logits, 9, 12);
  let pi = 0;
  let pc = phaseP[0] ?? 0;
  for (let i = 1; i < phaseP.length; i++) {
    const v = phaseP[i] ?? 0;
    if (v > pc) {
      pc = v;
      pi = i;
    }
  }
  const arg = (p: Float64Array) => {
    let bi = 0;
    let bv = p[0] ?? 0;
    for (let i = 1; i < p.length; i++) {
      const v = p[i] ?? 0;
      if (v > bv) {
        bv = v;
        bi = i;
      }
    }
    return bi;
  };
  return {
    phase: PHASES[pi] ?? "hold",
    threat: arg(threatP) === 1,
    seeTarget: arg(seeP) === 1,
    clearance: CLEARANCES[arg(clearP)] ?? "ok",
    confidence: Math.max(pc, confidenceFloor),
  };
}

export function forward(net: TinyNet, text: string): { logits: Float64Array; answer: PilotAnswer } {
  const x = featuresOf(text, net.blindDistance);
  let h = x;
  for (let li = 0; li < net.layers.length; li++) {
    const L = net.layers[li];
    if (!L) continue;
    const pre = new Float64Array(L.dout);
    for (let j = 0; j < L.dout; j++) {
      let s = L.b[j] ?? 0;
      for (let i = 0; i < L.din; i++) s += (h[i] ?? 0) * (L.w[i * L.dout + j] ?? 0);
      pre[j] = s;
    }
    const last = li === net.layers.length - 1;
    if (!last) {
      for (let j = 0; j < pre.length; j++) if ((pre[j] ?? 0) < 0) pre[j] = 0;
    }
    h = pre;
  }
  return { logits: h, answer: answerFromLogits(h) };
}

interface Adam {
  m: Float64Array;
  v: Float64Array;
}

function zerosLike(src: Float64Array) {
  return new Float64Array(src.length);
}

export function trainStudent(
  texts: string[],
  opts: { steps: number; seed?: number; lr?: number; blindDistance?: boolean; batch?: number },
): { net: TinyNet; loss: number } {
  const net = createNet(opts.seed ?? 11, opts.blindDistance ?? false);
  const lr = opts.lr ?? 0.04;
  const batch = opts.batch ?? 64;
  const rng = mulberry32((opts.seed ?? 11) + 99);
  const adamW: Adam[] = net.layers.map((L) => ({ m: zerosLike(L.w), v: zerosLike(L.w) }));
  const adamB: Adam[] = net.layers.map((L) => ({ m: zerosLike(L.b), v: zerosLike(L.b) }));
  let lastLoss = 1;
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;
  let tstep = 0;

  for (let step = 0; step < opts.steps; step++) {
    const gW = net.layers.map((L) => new Float64Array(L.w.length));
    const gB = net.layers.map((L) => new Float64Array(L.b.length));
    let loss = 0;
    const n = Math.min(batch, texts.length);
    for (let s = 0; s < n; s++) {
      const text = texts[Math.floor(rng() * texts.length)] ?? texts[0] ?? "";
      const label = rulesAnswer(text);
      const x = featuresOf(text, net.blindDistance);
      const acts: Float64Array[] = [x];
      const pres: Float64Array[] = [];
      let h = x;
      for (let li = 0; li < net.layers.length; li++) {
        const L = net.layers[li];
        if (!L) continue;
        const pre = new Float64Array(L.dout);
        for (let j = 0; j < L.dout; j++) {
          let sum = L.b[j] ?? 0;
          for (let i = 0; i < L.din; i++) sum += (h[i] ?? 0) * (L.w[i * L.dout + j] ?? 0);
          pre[j] = sum;
        }
        pres.push(pre);
        const last = li === net.layers.length - 1;
        const a = new Float64Array(L.dout);
        for (let j = 0; j < L.dout; j++) {
          const v = pre[j] ?? 0;
          a[j] = last ? v : v > 0 ? v : 0;
        }
        acts.push(a);
        h = a;
      }
      const logits = h;
      const grad = new Float64Array(OUT);
      loss += ce(logits, 0, 5, phaseIndex(label.phase), grad);
      loss += ce(logits, 5, 7, label.threat ? 1 : 0, grad);
      loss += ce(logits, 7, 9, label.seeTarget ? 1 : 0, grad);
      loss += ce(logits, 9, 12, clearanceIndex(label.clearance), grad);

      let g = grad;
      for (let li = net.layers.length - 1; li >= 0; li--) {
        const L = net.layers[li];
        const hIn = acts[li];
        const pre = pres[li];
        const gw = gW[li];
        const gb = gB[li];
        if (!L || !hIn || !pre || !gw || !gb) continue;
        const gIn = new Float64Array(L.din);
        const last = li === net.layers.length - 1;
        for (let j = 0; j < L.dout; j++) {
          const raw = g[j] ?? 0;
          const gj = last ? raw : (pre[j] ?? 0) > 0 ? raw : 0;
          gb[j] = (gb[j] ?? 0) + gj;
          for (let i = 0; i < L.din; i++) {
            gw[i * L.dout + j] = (gw[i * L.dout + j] ?? 0) + (hIn[i] ?? 0) * gj;
            gIn[i] = (gIn[i] ?? 0) + (L.w[i * L.dout + j] ?? 0) * gj;
          }
        }
        g = gIn;
      }
    }
    lastLoss = loss / n;
    tstep += 1;
    const b1 = 1 - Math.pow(beta1, tstep);
    const b2 = 1 - Math.pow(beta2, tstep);
    for (let li = 0; li < net.layers.length; li++) {
      const L = net.layers[li];
      const aw = adamW[li];
      const ab = adamB[li];
      const gw = gW[li];
      const gb = gB[li];
      if (!L || !aw || !ab || !gw || !gb) continue;
      for (let k = 0; k < L.w.length; k++) {
        const gvk = (gw[k] ?? 0) / n;
        aw.m[k] = beta1 * (aw.m[k] ?? 0) + (1 - beta1) * gvk;
        aw.v[k] = beta2 * (aw.v[k] ?? 0) + (1 - beta2) * gvk * gvk;
        const mhat = (aw.m[k] ?? 0) / b1;
        const vhat = (aw.v[k] ?? 0) / b2;
        L.w[k] = (L.w[k] ?? 0) - (lr * mhat) / (Math.sqrt(vhat) + eps);
      }
      for (let j = 0; j < L.b.length; j++) {
        const gvk = (gb[j] ?? 0) / n;
        ab.m[j] = beta1 * (ab.m[j] ?? 0) + (1 - beta1) * gvk;
        ab.v[j] = beta2 * (ab.v[j] ?? 0) + (1 - beta2) * gvk * gvk;
        const mhat = (ab.m[j] ?? 0) / b1;
        const vhat = (ab.v[j] ?? 0) / b2;
        L.b[j] = (L.b[j] ?? 0) - (lr * mhat) / (Math.sqrt(vhat) + eps);
      }
    }
  }
  return { net, loss: lastLoss };
}

function ce(logits: Float64Array, start: number, end: number, cls: number, grad: Float64Array) {
  const p = softmaxSlice(logits, start, end);
  let loss = 0;
  for (let k = 0; k < p.length; k++) {
    const pk = p[k] ?? 0;
    grad[start + k] = (grad[start + k] ?? 0) + pk - (k === cls ? 1 : 0);
    if (k === cls) loss -= Math.log(pk + 1e-9);
  }
  return loss;
}

export interface GateHit {
  name: string;
  expect: Phase;
  got: Phase;
  pass: boolean;
}

export function runGates(predict: (text: string) => Phase): GateHit[] {
  return GATES.map((g) => {
    const got = predict(g.text);
    return { name: g.name, expect: g.expect, got, pass: got === g.expect };
  });
}

export function gatesPass(hits: GateHit[]) {
  return hits.every((h) => h.pass);
}

export function weakDistanceNet(): TinyNet {
  const net = createNet(1, false);
  for (const L of net.layers) {
    L.w.fill(0);
    L.b.fill(0);
  }
  const [l1, l2, l3, l4] = net.layers;
  if (!l1 || !l2 || !l3 || !l4) return net;
  const w = (L: Layer, i: number, j: number, v: number) => {
    L.w[i * L.dout + j] = v;
  };
  // h0 low battery, h1 gps lost, h2 over the pad. Distance weights stay zero.
  w(l1, 6, 0, -1);
  l1.b[0] = 0.2;
  w(l1, 7, 1, -1);
  l1.b[1] = 1;
  w(l1, 8, 2, 1);
  for (const L of [l2, l3]) {
    w(L, 0, 0, 1);
    w(L, 1, 1, 1);
    w(L, 2, 2, 1);
  }
  l4.b[0] = 2;
  w(l4, 2, 2, 6);
  w(l4, 0, 3, 8000);
  w(l4, 1, 3, 20);
  l4.b[5] = 1;
  l4.b[9] = 1;
  return net;
}
