import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as flightWeightUrl } from "./bundled-g1t1dxb0.mjs";
import { a as Plane, c as Cpu, i as Play, l as Camera, n as Route, o as Map$1, r as Plus, s as House, u as Brain } from "../_libs/lucide-react.mjs";
import { a as saveModelBundle, i as getCatalog, n as Route$1, r as addModelFolder } from "./router-B5CF-zAI.mjs";
import { A as Vector2, C as PlaneGeometry, D as Scene, E as SRGBColorSpace, O as SphereGeometry, S as PerspectiveCamera, T as RepeatWrapping, _ as Mesh, a as CircleGeometry, b as NearestFilter, c as DirectionalLight, d as Fog, f as Group, g as LineSegments, h as LineBasicMaterial, i as CanvasTexture, j as Vector3, k as TorusGeometry, l as DodecahedronGeometry, m as InstancedMesh, n as BoxGeometry, o as Color, p as HemisphereLight, r as BufferGeometry, s as CylinderGeometry, t as WebGLRenderer, u as Float32BufferAttribute, v as MeshBasicMaterial, w as Raycaster, x as Object3D, y as MeshLambertMaterial } from "../_libs/three.mjs";
import { t as unzipSync } from "../_libs/fflate.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B-uKZkmg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PHASES = [
	"enroute",
	"approach",
	"land",
	"rtl",
	"hold"
];
var CLEARANCES = [
	"low",
	"ok",
	"tight"
];
var DIST_CENTERS = [
	1.5,
	4,
	8,
	40
];
var DIST_SIGMA = [
	1.3,
	2.1,
	3.2,
	16
];
function parseStateText(text) {
	const lower = text.toLowerCase();
	const tokens = lower.split(/\s+/).filter(Boolean);
	const numAfter = (key, fallback) => {
		const i = tokens.indexOf(key);
		if (i < 0 || i + 1 >= tokens.length) return fallback;
		const n = Number(tokens[i + 1]);
		return Number.isFinite(n) ? n : fallback;
	};
	const wordAfter = (key, fallback) => {
		const i = tokens.indexOf(key);
		if (i < 0 || i + 1 >= tokens.length) return fallback;
		return tokens[i + 1] ?? fallback;
	};
	const obstacle = wordAfter("obstacle", "none");
	const targetWord = wordAfter("target", "none");
	const target = targetWord === "visible" || targetWord === "hidden" || targetWord === "none" ? targetWord : "none";
	const gpsWord = wordAfter("gps", "yes");
	const gapDefault = obstacle === "none" ? 30 : 4;
	return {
		distance: numAfter("distance", 0),
		altitude: numAfter("altitude", 0),
		battery: numAfter("battery", 100),
		gps: gpsWord !== "no",
		obstacle,
		gap: numAfter("gap", gapDefault),
		target,
		overPad: lower.includes("over pad")
	};
}
/** Teacher. Far and healthy = enroute, close = approach, over the pad = land, low battery or lost GPS = rtl. */
function rulesAnswer(text) {
	const s = parseStateText(text);
	let phase;
	if (s.battery < 20 || !s.gps) phase = "rtl";
	else if (s.overPad) phase = "land";
	else if (s.distance <= 8) phase = "approach";
	else phase = "enroute";
	const threat = s.obstacle !== "none" && s.gap < 10;
	let clearance = "low";
	if (s.obstacle !== "none") {
		if (s.gap < 5) clearance = "tight";
		else if (s.gap < 12) clearance = "ok";
		else clearance = "low";
	}
	return {
		phase,
		threat,
		clearance,
		seeTarget: s.target === "visible",
		confidence: 1
	};
}
function featuresOf(text, blindDistance = false) {
	const s = parseStateText(text);
	const x = /* @__PURE__ */ new Float64Array(16);
	const d = blindDistance ? 46 : s.distance;
	const altitude = blindDistance ? 12 : s.altitude;
	x[0] = Math.min(Math.max(d, 0), 150) / 150;
	for (let k = 0; k < DIST_CENTERS.length; k++) {
		const c = DIST_CENTERS[k] ?? 0;
		const sig = DIST_SIGMA[k] ?? 1;
		const z = (d - c) / sig;
		x[1 + k] = Math.exp(-.5 * z * z);
	}
	x[5] = Math.min(Math.max(altitude, 0), 50) / 50;
	x[6] = Math.min(Math.max(s.battery, 0), 100) / 100;
	x[7] = s.gps ? 1 : 0;
	x[8] = s.overPad ? 1 : 0;
	x[9] = s.obstacle === "none" ? 1 : 0;
	x[10] = s.obstacle === "trunk" ? 1 : 0;
	x[11] = s.obstacle !== "none" && s.obstacle !== "trunk" ? 1 : 0;
	x[12] = s.target === "visible" ? 1 : 0;
	x[13] = s.target === "hidden" ? 1 : 0;
	x[14] = Math.min(Math.max(s.gap, 0), 40) / 40;
	x[15] = 1;
	return x;
}
function buildStateText(s) {
	const parts = [
		s.map ? `map ${s.map}` : "",
		`distance ${Math.round(s.distance)}`,
		`altitude ${Math.round(s.altitude)}`,
		`battery ${Math.round(s.battery)}`,
		`gps ${s.gps ? "yes" : "no"}`,
		`obstacle ${s.obstacle || "none"}`,
		`gap ${Math.round(s.gap)}`,
		`target ${s.target}`
	].filter(Boolean);
	if (s.overPad) parts.push("over pad");
	return parts.join(" ");
}
var GATES = [
	{
		name: "far",
		text: "map corvid distance 80 altitude 15 battery 90 gps yes obstacle none gap 30 target visible",
		expect: "enroute"
	},
	{
		name: "distance 4",
		text: "map heron distance 4 altitude 8 battery 80 gps yes obstacle none gap 20 target visible",
		expect: "approach"
	},
	{
		name: "over the pad",
		text: "map falcon distance 1 altitude 2 battery 70 gps yes obstacle none gap 16 target visible over pad",
		expect: "land"
	},
	{
		name: "battery 15",
		text: "map corvid distance 40 altitude 12 battery 15 gps yes obstacle none gap 22 target visible",
		expect: "rtl"
	},
	{
		name: "gps lost",
		text: "map heron distance 30 altitude 10 battery 60 gps no obstacle none gap 18 target none",
		expect: "rtl"
	}
];
function phaseIndex(phase) {
	return PHASES.indexOf(phase);
}
function clearanceIndex(c) {
	return CLEARANCES.indexOf(c);
}
var SHAPE = [
	[16, 32],
	[32, 32],
	[32, 32],
	[32, 12]
];
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function randn(rng) {
	const u = Math.max(rng(), 1e-9);
	const v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}
function createNet(seed = 7, blindDistance = false) {
	const rng = mulberry32(seed);
	return {
		layers: SHAPE.map(([din, dout]) => {
			const scale = Math.sqrt(2 / din);
			const w = new Float64Array(din * dout);
			for (let i = 0; i < w.length; i++) w[i] = randn(rng) * scale * .6;
			return {
				w,
				b: new Float64Array(dout),
				din,
				dout
			};
		}),
		blindDistance
	};
}
function softmaxSlice(logits, start, end) {
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
function answerFromLogits(logits, confidenceFloor = 0) {
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
	const arg = (p) => {
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
		confidence: Math.max(pc, confidenceFloor)
	};
}
function zerosLike(src) {
	return new Float64Array(src.length);
}
function trainStudent(texts, opts) {
	const net = createNet(opts.seed ?? 11, opts.blindDistance ?? false);
	const lr = opts.lr ?? .04;
	const batch = opts.batch ?? 64;
	const rng = mulberry32((opts.seed ?? 11) + 99);
	const adamW = net.layers.map((L) => ({
		m: zerosLike(L.w),
		v: zerosLike(L.w)
	}));
	const adamB = net.layers.map((L) => ({
		m: zerosLike(L.b),
		v: zerosLike(L.b)
	}));
	let lastLoss = 1;
	const beta1 = .9;
	const beta2 = .999;
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
			const acts = [x];
			const pres = [];
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
			const grad = /* @__PURE__ */ new Float64Array(12);
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
				aw.m[k] = beta1 * (aw.m[k] ?? 0) + .09999999999999998 * gvk;
				aw.v[k] = beta2 * (aw.v[k] ?? 0) + .0010000000000000009 * gvk * gvk;
				const mhat = (aw.m[k] ?? 0) / b1;
				const vhat = (aw.v[k] ?? 0) / b2;
				L.w[k] = (L.w[k] ?? 0) - lr * mhat / (Math.sqrt(vhat) + eps);
			}
			for (let j = 0; j < L.b.length; j++) {
				const gvk = (gb[j] ?? 0) / n;
				ab.m[j] = beta1 * (ab.m[j] ?? 0) + .09999999999999998 * gvk;
				ab.v[j] = beta2 * (ab.v[j] ?? 0) + .0010000000000000009 * gvk * gvk;
				const mhat = (ab.m[j] ?? 0) / b1;
				const vhat = (ab.v[j] ?? 0) / b2;
				L.b[j] = (L.b[j] ?? 0) - lr * mhat / (Math.sqrt(vhat) + eps);
			}
		}
	}
	return {
		net,
		loss: lastLoss
	};
}
function ce(logits, start, end, cls, grad) {
	const p = softmaxSlice(logits, start, end);
	let loss = 0;
	for (let k = 0; k < p.length; k++) {
		const pk = p[k] ?? 0;
		grad[start + k] = (grad[start + k] ?? 0) + pk - (k === cls ? 1 : 0);
		if (k === cls) loss -= Math.log(pk + 1e-9);
	}
	return loss;
}
function runGates(predict) {
	return GATES.map((g) => {
		const got = predict(g.text);
		return {
			name: g.name,
			expect: g.expect,
			got,
			pass: got === g.expect
		};
	});
}
function gatesPass(hits) {
	return hits.every((h) => h.pass);
}
function varint(n) {
	const out = [];
	let v = n >>> 0;
	while (v > 127) {
		out.push(v & 127 | 128);
		v >>>= 7;
	}
	out.push(v);
	return out;
}
function concat(parts) {
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
function u8(nums) {
	return new Uint8Array(nums);
}
function key(field, wire) {
	return u8(varint(field << 3 | wire));
}
function bytesField(field, data) {
	return concat([
		key(field, 2),
		u8(varint(data.length)),
		data
	]);
}
function strField(field, s) {
	return bytesField(field, new TextEncoder().encode(s));
}
function varField(field, n) {
	return concat([key(field, 0), u8(varint(n))]);
}
function f32bytes(arr) {
	const buf = new Uint8Array(arr.length * 4);
	const view = new DataView(buf.buffer);
	for (let i = 0; i < arr.length; i++) view.setFloat32(i * 4, arr[i] ?? 0, true);
	return buf;
}
function tensor(name, dims, data) {
	const parts = [];
	for (const d of dims) parts.push(varField(1, d));
	parts.push(varField(2, 1));
	parts.push(strField(8, name));
	parts.push(bytesField(9, f32bytes(data)));
	return concat(parts);
}
function tensorShape(dims) {
	return bytesField(2, concat(dims.map((d) => bytesField(1, varField(1, d)))));
}
function valueInfo(name, dims) {
	const type = bytesField(1, concat([varField(1, 1), tensorShape(dims)]));
	return concat([strField(1, name), bytesField(2, type)]);
}
function node(op, inputs, outputs) {
	const parts = [];
	for (const i of inputs) parts.push(strField(1, i));
	for (const o of outputs) parts.push(strField(2, o));
	parts.push(strField(4, op));
	return concat(parts);
}
function netToOnnx(net) {
	const inits = [];
	const nodes = [];
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
	const graph = concat([
		...nodes,
		strField(2, "moka-tiny"),
		...inits,
		bytesField(11, valueInfo("state", [1, 16])),
		bytesField(12, valueInfo("logits", [1, 12]))
	]);
	const opset = concat([strField(1, ""), varField(2, 13)]);
	return concat([
		varField(1, 8),
		strField(2, "moka-tiny"),
		bytesField(7, graph),
		bytesField(8, opset)
	]);
}
function readVarint(buf, p) {
	let shift = 0;
	let n = 0;
	while (p < buf.length) {
		const b = buf[p] ?? 0;
		p += 1;
		n |= (b & 127) << shift;
		if ((b & 128) === 0) return [n >>> 0, p];
		shift += 7;
		if (shift > 28) break;
	}
	throw new Error("bad varint");
}
function readFields(buf) {
	const map = /* @__PURE__ */ new Map();
	let p = 0;
	while (p < buf.length) {
		const [k, p1] = readVarint(buf, p);
		p = p1;
		const field = k >>> 3;
		const wire = k & 7;
		let val;
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
		} else throw new Error("onnx wire");
		const list = map.get(field) ?? [];
		list.push(val);
		map.set(field, list);
	}
	return map;
}
function asBytes(v) {
	if (v instanceof Uint8Array) return v;
	throw new Error("expected bytes");
}
function utf8(b) {
	return new TextDecoder().decode(b);
}
function parseTensor(buf) {
	const f = readFields(buf);
	const dims = (f.get(1) ?? []).map((v) => typeof v === "number" ? v : 0);
	const name = utf8(asBytes((f.get(8) ?? [])[0]));
	const raw = asBytes((f.get(9) ?? [])[0]);
	const copy = new Uint8Array(raw.byteLength);
	copy.set(raw);
	return {
		name,
		dims,
		data: new Float32Array(copy.buffer)
	};
}
function parseNode(buf) {
	const f = readFields(buf);
	const inputs = (f.get(1) ?? []).map((v) => utf8(asBytes(v)));
	const outputs = (f.get(2) ?? []).map((v) => utf8(asBytes(v)));
	return {
		op: utf8(asBytes((f.get(4) ?? [])[0])),
		inputs,
		outputs
	};
}
function parseOnnx(bytes) {
	const graph = readFields(asBytes((readFields(bytes).get(7) ?? [])[0]));
	const tensors = /* @__PURE__ */ new Map();
	for (const init of graph.get(5) ?? []) {
		const t = parseTensor(asBytes(init));
		tensors.set(t.name, t);
	}
	const nodes = (graph.get(1) ?? []).map((n) => parseNode(asBytes(n)));
	if (nodes.length < 4) throw new Error("not moka-tiny");
	return { forward(x) {
		const env = /* @__PURE__ */ new Map();
		env.set("state", x);
		for (const t of tensors.values()) env.set(t.name, t.data);
		const shape = /* @__PURE__ */ new Map();
		shape.set("state", [1, x.length]);
		for (const t of tensors.values()) shape.set(t.name, t.dims);
		for (const n of nodes) if (n.op === "MatMul") {
			const a = env.get(n.inputs[0] ?? "");
			const b = env.get(n.inputs[1] ?? "");
			const ad = shape.get(n.inputs[0] ?? "") ?? [1, a?.length ?? 0];
			const bd = shape.get(n.inputs[1] ?? "") ?? [];
			if (!a || !b) throw new Error("matmul");
			const rows = ad[0] ?? 1;
			const k = ad[1] ?? a.length;
			const cols = bd[1] ?? bd[0] ?? b.length / k;
			const y = new Float32Array(rows * cols);
			for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
				let s = 0;
				for (let t = 0; t < k; t++) s += (a[r * k + t] ?? 0) * (b[t * cols + c] ?? 0);
				y[r * cols + c] = s;
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
		} else throw new Error(`op ${n.op}`);
		const logits = env.get("logits");
		if (!logits || logits.length < 12) throw new Error("no logits");
		return logits;
	} };
}
function inferOnnx(bytes, text, blindDistance = false) {
	const x64 = featuresOf(text, blindDistance);
	const x = new Float32Array(x64.length);
	for (let i = 0; i < x64.length; i++) x[i] = x64[i] ?? 0;
	const net = parseOnnx(bytes);
	return answerFromLogits(new Float64Array(net.forward(x)));
}
async function hydrateModel(model) {
	if (model.modelBase64 || model.kind !== "student") return model;
	const url = flightWeightUrl(model.id);
	if (!url) return model;
	const res = await fetch(url);
	if (!res.ok) return model;
	const bytes = new Uint8Array(await res.arrayBuffer());
	return {
		...model,
		modelBase64: bytesToBase64(bytes),
		flight: true
	};
}
function pilotFor(model) {
	if (!model || model.kind === "rules" || model.id === "rules") return (text) => ({
		...rulesAnswer(text),
		source: "rules",
		label: "rules"
	});
	if (model.kind === "laya" || model.flight === false && model.kind !== "student") return (text) => ({
		...rulesAnswer(text),
		source: "laya",
		label: "not a flight pilot"
	});
	const bytes = decode(model.modelBase64);
	if (!bytes) return (text) => ({
		...rulesAnswer(text),
		source: "fallback",
		label: "rules, not moka"
	});
	try {
		const net = parseOnnx(bytes);
		const label = (model.note ?? "").toLowerCase().includes("weak") || model.id === "moka-flight" ? `${model.name} · weak on distance` : model.name;
		return (text) => {
			try {
				const x64 = featuresOf(text, false);
				const x = new Float32Array(x64.length);
				for (let i = 0; i < x64.length; i++) x[i] = x64[i] ?? 0;
				const logits = net.forward(x);
				return {
					...answerFromLogits(Float64Array.from(logits)),
					source: "moka",
					label
				};
			} catch {
				return {
					...rulesAnswer(text),
					source: "fallback",
					label: "rules, not moka"
				};
			}
		};
	} catch {
		return (text) => ({
			...rulesAnswer(text),
			source: "fallback",
			label: "rules, not moka"
		});
	}
}
function decode(b64) {
	if (!b64 || typeof atob !== "function") return null;
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
function bytesToBase64(bytes) {
	let s = "";
	const chunk = 32768;
	for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(s);
}
function line(p) {
	return buildStateText({
		map: p.map,
		distance: p.distance,
		altitude: p.altitude,
		battery: p.battery,
		gps: p.gps,
		obstacle: p.obstacle,
		gap: p.gap,
		target: p.target,
		overPad: !!p.overPad
	});
}
/** Synthetic rows across Corvid, Heron, and Falcon. Labels are applied later by the rules teacher. */
function curriculumRows() {
	const maps = [
		"corvid",
		"heron",
		"falcon"
	];
	const rows = [];
	const push = (text, map) => rows.push({
		text,
		mark: "unmarked",
		map
	});
	for (const map of maps) {
		for (const distance of [
			16,
			22,
			30,
			46,
			58,
			74,
			92
		]) for (const altitude of [
			6,
			12,
			22
		]) for (const battery of [55, 90]) push(line({
			map,
			distance,
			altitude,
			battery,
			gps: true,
			obstacle: "none",
			gap: 28,
			target: battery > 70 ? "visible" : "hidden"
		}), map);
		for (const distance of [
			2.4,
			3,
			4,
			5,
			6,
			7.5
		]) for (const altitude of [
			3,
			8,
			14
		]) for (const battery of [48, 88]) push(line({
			map,
			distance,
			altitude,
			battery,
			gps: true,
			obstacle: "none",
			gap: 18,
			target: distance < 6 ? "visible" : "hidden"
		}), map);
		for (const distance of [
			.4,
			1,
			1.6
		]) for (const altitude of [
			1,
			3,
			6
		]) push(line({
			map,
			distance,
			altitude,
			battery: 68,
			gps: true,
			obstacle: "none",
			gap: 16,
			target: "visible",
			overPad: true
		}), map);
		for (const battery of [
			4,
			9,
			15,
			19
		]) for (const distance of [
			12,
			40,
			70
		]) push(line({
			map,
			distance,
			altitude: 11,
			battery,
			gps: true,
			obstacle: "none",
			gap: 20,
			target: "visible"
		}), map);
		for (const distance of [
			8,
			24,
			55
		]) {
			push(line({
				map,
				distance,
				altitude: 9,
				battery: 77,
				gps: false,
				obstacle: "none",
				gap: 24,
				target: "none"
			}), map);
			push(line({
				map,
				distance,
				altitude: 14,
				battery: 41,
				gps: false,
				obstacle: "rock",
				gap: 7,
				target: "hidden"
			}), map);
		}
		for (const gap of [
			2,
			3,
			4,
			6
		]) {
			push(line({
				map,
				distance: 26,
				altitude: 7,
				battery: 86,
				gps: true,
				obstacle: "trunk",
				gap,
				target: "visible"
			}), map);
			push(line({
				map,
				distance: 18,
				altitude: 6,
				battery: 63,
				gps: true,
				obstacle: "trunk",
				gap,
				target: "hidden"
			}), map);
		}
		for (const obstacle of [
			"roof",
			"ridge",
			"wire",
			"drone",
			"hazard"
		]) push(line({
			map,
			distance: 34,
			altitude: 10,
			battery: 71,
			gps: true,
			obstacle,
			gap: 5,
			target: "hidden"
		}), map);
	}
	return rows;
}
function trainingTexts(recorded) {
	const base = curriculumRows();
	const texts = [];
	for (const row of base) texts.push(row.text);
	for (const row of recorded) {
		texts.push(row.text);
		if (row.mark === "good") {
			texts.push(row.text);
			texts.push(row.text);
		}
	}
	return texts;
}
function slug$1(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "moka-beam";
}
function rowCount(recorded) {
	return trainingTexts(recorded).length;
}
async function trainStudentBundle(opts) {
	const recorded = opts.recorded;
	const texts = trainingTexts(recorded);
	if (texts.length < 300) throw new Error(`Need a few hundred rows before a train. Have ${texts.length}.`);
	await yieldPaint();
	let base = slug$1(opts.name);
	let id = base;
	let n = 2;
	const taken = new Set(opts.taken);
	while (taken.has(id)) {
		id = `${base}-${n}`;
		n += 1;
	}
	const trained = trainStudent(texts, {
		steps: 260,
		seed: Date.now() % 9e3 + 2,
		lr: .045,
		batch: 72
	});
	const onnx = netToOnnx(trained.net);
	const hits = runGates((text) => inferOnnx(onnx, text, false).phase);
	const passed = gatesPass(hits);
	const manifest = {
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
		modelBase64: passed ? bytesToBase64(onnx) : void 0
	};
	let savedPath;
	if (passed) savedPath = (await saveModelBundle({ data: {
		id,
		manifest,
		onnxBase64: bytesToBase64(onnx),
		tokenizer: JSON.stringify({
			type: "moka-tiny-v1",
			features: 16,
			note: "Whitespace state text into 16 features, then four linear layers."
		}, null, 2),
		config: JSON.stringify({
			id,
			name: manifest.name,
			kind: "student",
			arch: "moka-tiny",
			layers: 4,
			trained_on: manifest.trained_on
		}, null, 2)
	} })).path;
	return {
		name: manifest.name,
		id,
		loss: trained.loss,
		gates: hits,
		passed,
		savedPath,
		rows: texts.length,
		model: manifest
	};
}
function curriculumSize() {
	return curriculumRows().length;
}
function yieldPaint() {
	return new Promise((resolve) => setTimeout(resolve, 40));
}
function homeOf(map, fallback) {
	const h = map.home_pad;
	if (!h) return fallback;
	return {
		x: typeof h.x === "number" ? h.x : fallback.x,
		y: typeof h.y === "number" ? h.y : fallback.y,
		z: typeof h.z === "number" ? h.z : fallback.z
	};
}
function buildWorld(map) {
	const biome = map.biome ?? "flat";
	const origin = {
		lat: map.origin?.lat ?? 0,
		lon: map.origin?.lon ?? 0
	};
	if (biome === "city") return city(map, origin);
	if (biome === "woods") return woods(map, origin);
	if (biome === "desert") return desert(map, origin);
	const home = homeOf(map, {
		x: 0,
		y: .25,
		z: 0
	});
	return {
		id: map.id,
		biome,
		home,
		origin,
		cruise: 8,
		fence: 70,
		sky: 2371624,
		fog: 1712668,
		ground: 2765608,
		accent: 14086746,
		buildings: [],
		trees: [],
		rocks: [],
		ridge: null,
		wires: [],
		streamZ: null,
		park: null,
		sample: [
			{
				x: home.x,
				y: 6,
				z: home.z + 18
			},
			{
				x: home.x + 16,
				y: 6,
				z: home.z + 34
			},
			{
				x: home.x + 16,
				y: home.y,
				z: home.z + 46
			}
		],
		thread: []
	};
}
function city(map, origin) {
	const home = homeOf(map, {
		x: 0,
		y: 12,
		z: 0
	});
	const buildings = [{
		x: home.x,
		y: home.y / 2,
		z: home.z,
		w: 16,
		h: home.y,
		d: 16,
		tint: 4610154
	}];
	for (const [x, z, w, h, d] of [
		[
			-30,
			-26,
			14,
			9,
			12
		],
		[
			-32,
			6,
			12,
			11,
			14
		],
		[
			-26,
			32,
			13,
			7,
			11
		],
		[
			4,
			-30,
			15,
			8,
			13
		],
		[
			2,
			30,
			12,
			10,
			12
		],
		[
			30,
			8,
			14,
			12,
			13
		],
		[
			32,
			32,
			11,
			8,
			12
		],
		[
			-50,
			-8,
			10,
			13,
			11
		],
		[
			50,
			-12,
			12,
			9,
			12
		],
		[
			18,
			-48,
			11,
			7,
			10
		]
	]) buildings.push({
		x,
		y: h / 2,
		z,
		w,
		h,
		d,
		tint: 3227986 + Math.abs(x * 3 + z) % 18 * 263172 & 16777215
	});
	const wires = [
		wire(home.x, home.y + .4, home.z, -30, 9.4, -26),
		wire(-30, 9.4, -26, -32, 11.4, 6),
		wire(home.x, home.y + .4, home.z, 4, 8.4, -30),
		wire(30, 12.4, 8, 32, 8.4, 32),
		wire(-32, 11.4, 6, -26, 7.4, 32)
	];
	return {
		id: map.id,
		biome: "city",
		home,
		origin,
		cruise: 16,
		fence: 72,
		sky: 1779766,
		fog: 2372164,
		ground: 1711652,
		accent: 14086746,
		buildings,
		trees: [
			{
				x: 40,
				z: -34,
				trunkH: 3.2,
				r: .18,
				canopy: 1.6,
				lethal: false
			},
			{
				x: 34,
				z: -40,
				trunkH: 2.8,
				r: .16,
				canopy: 1.5,
				lethal: false
			},
			{
				x: 46,
				z: -28,
				trunkH: 3.4,
				r: .18,
				canopy: 1.7,
				lethal: false
			}
		],
		rocks: [],
		ridge: null,
		wires,
		streamZ: null,
		park: {
			x: 40,
			z: -36,
			w: 24,
			d: 22
		},
		sample: [
			{
				x: home.x,
				y: 16,
				z: home.z + 22
			},
			{
				x: -16,
				y: 16,
				z: 26
			},
			{
				x: 22,
				y: 8,
				z: 8
			},
			{
				x: 40,
				y: 2,
				z: -30
			}
		],
		thread: [{
			x: home.x,
			y: 14,
			z: home.z + 16
		}, {
			x: 16,
			y: 12,
			z: 20
		}]
	};
}
function woods(map, origin) {
	const home = homeOf(map, {
		x: 0,
		y: .2,
		z: 0
	});
	const trees = [];
	for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
		if (i === 0 && j === 0) continue;
		const x = i * 18 + (i * 5 + j * 3) % 5 - 2;
		const z = j * 18 + (j * 4 + i * 2) % 5 - 2;
		if (Math.hypot(x - home.x, z - home.z) < 13) continue;
		if (Math.abs(z - 26) < 3.2) continue;
		trees.push({
			x,
			z,
			trunkH: 12 + Math.abs(i * 3 + j) % 4,
			r: .42,
			canopy: 3.1,
			lethal: true
		});
	}
	const thread = [];
	for (const g of [
		{
			x: 8,
			z: 16
		},
		{
			x: -6,
			z: 34
		},
		{
			x: 14,
			z: 46
		},
		{
			x: -16,
			z: 18
		}
	]) {
		let ok = true;
		for (const t of trees) if (Math.hypot(g.x - t.x, g.z - t.z) < t.r + 2.4) ok = false;
		if (ok) thread.push({
			x: g.x,
			y: 6.2,
			z: g.z
		});
	}
	if (thread.length < 2) thread.push({
		x: 20,
		y: 6.2,
		z: 20
	}, {
		x: -20,
		y: 6.2,
		z: 36
	});
	return {
		id: map.id,
		biome: "woods",
		home,
		origin,
		cruise: 6.4,
		fence: 70,
		sky: 1715236,
		fog: 2373164,
		ground: 1845792,
		accent: 14086746,
		buildings: [],
		trees,
		rocks: [{
			x: 22,
			z: -8,
			s: 1.1
		}, {
			x: -18,
			z: 8,
			s: .8
		}],
		ridge: null,
		wires: [],
		streamZ: 26,
		park: null,
		sample: [
			{
				x: 10,
				y: 6,
				z: 14
			},
			{
				x: -4,
				y: 6,
				z: 32
			},
			{
				x: 12,
				y: 5,
				z: 44
			}
		],
		thread
	};
}
function desert(map, origin) {
	const home = homeOf(map, {
		x: 0,
		y: .25,
		z: 18
	});
	return {
		id: map.id,
		biome: "desert",
		home,
		origin,
		cruise: 8,
		fence: 78,
		sky: 15124378,
		fog: 14136458,
		ground: 13214574,
		accent: 14086746,
		buildings: [],
		trees: [],
		rocks: [
			{
				x: -16,
				z: 6,
				s: 1.4
			},
			{
				x: 14,
				z: -2,
				s: 1.1
			},
			{
				x: 22,
				z: 24,
				s: .9
			},
			{
				x: -24,
				z: 28,
				s: 1.6
			},
			{
				x: 8,
				z: -18,
				s: 1.2
			},
			{
				x: -8,
				z: -36,
				s: 1.5
			},
			{
				x: 30,
				z: -30,
				s: 1
			}
		],
		ridge: {
			x: 0,
			y: 4,
			z: -30,
			w: 70,
			h: 8,
			d: 12,
			tint: 11569512
		},
		wires: [],
		streamZ: null,
		park: null,
		sample: [
			{
				x: 0,
				y: 7,
				z: 4
			},
			{
				x: 26,
				y: 8,
				z: -8
			},
			{
				x: 28,
				y: 7,
				z: -42
			},
			{
				x: -18,
				y: .4,
				z: 8
			}
		],
		thread: [{
			x: 10,
			y: 6,
			z: 0
		}, {
			x: 24,
			y: 6,
			z: -16
		}]
	};
}
function wire(ax, ay, az, bx, by, bz) {
	return {
		ax,
		ay,
		az,
		bx,
		by,
		bz
	};
}
var keys = /* @__PURE__ */ new Set();
var live = {
	craft: idleCraft(),
	status: "idle",
	battery: 100,
	gpsOn: true,
	t: 0,
	runId: 0,
	dist: 0,
	nearest: "none",
	nearestM: 99,
	command: "hold",
	modelPhase: "hold",
	rulesPhase: "hold",
	threat: false,
	see: false,
	clearance: "low",
	confidence: 1,
	pilotLabel: "rules",
	weak: false,
	note: "",
	failReason: "",
	lat: 0,
	lon: 0,
	east: 0,
	north: 0,
	alt: 0,
	target: null,
	actors: [],
	goals: [],
	goalIndex: 0,
	log: [],
	rows: [],
	world: null,
	lostFor: 0,
	search: false,
	steerOverride: null,
	config: null,
	decisionAcc: 0,
	logAcc: 0,
	home: {
		x: 0,
		y: .3,
		z: 0
	}
};
var listeners = /* @__PURE__ */ new Set();
var version = 0;
function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}
function getVersion() {
	return version;
}
function bump() {
	version += 1;
	for (const fn of listeners) fn();
}
function refreshHud() {
	bump();
}
function idleCraft() {
	return {
		x: 0,
		y: .4,
		z: 0,
		vx: 0,
		vy: 0,
		vz: 0,
		yaw: Math.PI
	};
}
function steerClimb() {
	let steer = live.steerOverride ?? 0;
	let climb = 0;
	if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
	if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
	if (keys.has("KeyW") || keys.has("ArrowUp")) climb += 1;
	if (keys.has("KeyS") || keys.has("ArrowDown")) climb -= 1;
	return {
		steer: Math.max(-1, Math.min(1, steer)),
		climb: Math.max(-1, Math.min(1, climb))
	};
}
function placeOnPad(world) {
	const h = world.home;
	live.world = world;
	live.home = { ...h };
	live.craft = {
		x: h.x,
		y: h.y + .35,
		z: h.z,
		vx: 0,
		vy: 0,
		vz: 0,
		yaw: Math.PI
	};
	live.battery = 100;
	live.t = 0;
	live.status = "idle";
	live.command = "hold";
	live.modelPhase = "hold";
	live.rulesPhase = "hold";
	live.dist = 0;
	live.failReason = "";
	live.note = "";
	live.target = null;
	live.actors = [];
	live.goals = [];
	live.goalIndex = 0;
	live.lostFor = 0;
	live.search = false;
	live.config = null;
	live.decisionAcc = 0;
	publishGps();
	bump();
}
function arm(config) {
	placeOnPad(config.world);
	live.config = config;
	live.goals = config.goals.map((g) => ({ ...g }));
	live.goalIndex = 0;
	live.status = "running";
	live.runId += 1;
	live.battery = 100;
	live.t = 0;
	bump();
}
function goHome() {
	const world = live.world;
	if (!world) return;
	const gps = live.gpsOn;
	placeOnPad(world);
	live.gpsOn = gps;
	live.log = [{
		t: 0,
		model: "—",
		rules: "—",
		cmd: "hold",
		threat: "no",
		see: "no",
		clearance: "low",
		note: "home"
	}, ...live.log].slice(0, 40);
	bump();
}
function markRun(mark) {
	for (const row of live.rows) if (row.runId === live.runId) row.mark = mark;
	bump();
}
function tick(dt) {
	const config = live.config;
	const world = live.world;
	if (!config || !world || live.status !== "running") return;
	const step = Math.min(dt, .05);
	live.t += step;
	const craft = live.craft;
	const { steer, climb } = steerClimb();
	const target = trackPoint(config, live.t);
	live.target = config.modeKind === "track" ? target : null;
	live.actors = config.modeKind === "opposed" ? opposedActors(config, live.t) : [];
	live.decisionAcc += step;
	if (live.decisionAcc >= .1) {
		live.decisionAcc = 0;
		decide(config, world);
	}
	const goal = activeGoal(config);
	const dx = goal.x - craft.x;
	const dz = goal.z - craft.z;
	const distH = Math.hypot(dx, dz);
	live.dist = distH;
	let dirx = distH > .05 ? dx / distH : 0;
	let dirz = distH > .05 ? dz / distH : 0;
	const skirt = avoidDir(dirx, dirz, craft, world, live.actors, config.modeKind);
	dirx = skirt.x;
	dirz = skirt.z;
	const phase = live.command;
	let speed = phase === "enroute" ? 8.5 : phase === "approach" ? 3.2 : phase === "land" ? 1.3 : phase === "rtl" ? 9.2 : 0;
	if (phase === "approach" && distH < 3) speed = 1.25;
	if (phase === "land" && distH < 1.15) speed = 0;
	let tvx = dirx * speed;
	let tvz = dirz * speed;
	if (phase === "hold" || live.search) {
		tvx = 0;
		tvz = 0;
	}
	const k = 4.2;
	craft.vx += clamp((tvx - craft.vx) * k, -16, 16) * step;
	craft.vz += clamp((tvz - craft.vz) * k, -16, 16) * step;
	let targetY = world.cruise;
	if (config.modeKind === "track" && live.target) targetY = live.target.y + (phase === "approach" || phase === "land" ? 2.2 : 4.5);
	else if (phase === "approach") targetY = goal.y + Math.max(1.6, distH * .28);
	else if (phase === "land") targetY = goal.y + .32;
	else if (phase === "hold") targetY = craft.y;
	if (climb !== 0) targetY = craft.y + climb * 6;
	const ay = clamp(((targetY - craft.y) * 2.4 - craft.vy) * 3.2, -10, 10);
	craft.vy += ay * step;
	const moving = Math.hypot(tvx, tvz);
	let desiredYaw = craft.yaw;
	if (moving > .4) desiredYaw = Math.atan2(-tvx, -tvz);
	if (Math.abs(steer) > .05) craft.yaw += steer * 1.9 * step;
	else if (live.search) craft.yaw += .7 * step;
	else {
		const diff = wrap(desiredYaw - craft.yaw);
		craft.yaw += clamp(diff, -2.5 * step, 2.5 * step);
	}
	craft.x += craft.vx * step;
	craft.y += craft.vy * step;
	craft.z += craft.vz * step;
	if (craft.y < .3) {
		craft.y = .3;
		if (craft.vy < 0) craft.vy = 0;
	}
	resolveBuildings(craft, world);
	resolveSolids(craft, live.actors);
	const sp = Math.hypot(craft.vx, craft.vz);
	live.battery = Math.max(0, live.battery - step * (.42 + sp * .07));
	publishGps();
	if (config.modeKind === "thread") for (const tree of world.trees) {
		if (!tree.lethal) continue;
		if (Math.hypot(craft.x - tree.x, craft.z - tree.z) < tree.r + .5 && craft.y < tree.trunkH) {
			live.status = "failed";
			live.failReason = "Hit a trunk";
			live.command = "hold";
			craft.vx = 0;
			craft.vz = 0;
			craft.vy = 0;
			bump();
			return;
		}
	}
	const landing = landingPoint(config);
	const distLand = Math.hypot(craft.x - landing.x, craft.z - landing.z);
	if ((phase === "land" || live.note === "battery" && distLand < 2) && distLand < 1.35 && Math.abs(craft.y - (landing.y + .32)) < .55 && sp < .8) {
		live.status = "landed";
		craft.vx = 0;
		craft.vz = 0;
		craft.vy = 0;
		craft.y = landing.y + .32;
		live.command = "land";
		pushLog("landed");
		bump();
		return;
	}
	if (config.modeKind !== "track" && phase !== "rtl" && phase !== "land") {
		if (live.goals[live.goalIndex] && live.goalIndex < live.goals.length - 1 && distH < 3) live.goalIndex += 1;
	}
}
function decide(config, world) {
	const craft = live.craft;
	const goal = activeGoal(config);
	const dist = Math.hypot(goal.x - craft.x, goal.z - craft.z);
	const obs = nearestObs(craft, world, live.actors);
	live.nearest = obs.kind;
	live.nearestM = obs.gap;
	const seeGeom = canSee(craft, goal, world, live.actors);
	const landing = landingPoint(config);
	const distPad = Math.hypot(craft.x - landing.x, craft.z - landing.z);
	const overPad = distPad < 2.15;
	const text = buildStateText({
		map: world.id,
		distance: dist,
		altitude: craft.y,
		battery: live.battery,
		gps: live.gpsOn,
		obstacle: obs.kind,
		gap: obs.gap,
		target: seeGeom ? "visible" : goal ? "hidden" : "none",
		overPad
	});
	const rules = rulesAnswer(text);
	let asked;
	try {
		asked = config.ask(text);
	} catch {
		asked = {
			...rules,
			source: "fallback",
			label: "rules, not moka"
		};
	}
	live.modelPhase = asked.phase;
	live.rulesPhase = rules.phase;
	live.threat = asked.threat;
	live.see = asked.seeTarget;
	live.clearance = asked.clearance;
	live.confidence = asked.confidence;
	live.pilotLabel = asked.label;
	live.weak = asked.label.toLowerCase().includes("weak");
	let phase = asked.phase;
	let note = "";
	if (asked.source !== "rules" && asked.confidence < .45) {
		phase = "hold";
		note = "low confidence";
	}
	if (config.modeKind === "track") {
		if (!seeGeom) live.lostFor += .1;
		else live.lostFor = 0;
		if (live.lostFor >= 12) {
			phase = "rtl";
			note = "target lost";
			live.search = false;
		} else if (live.lostFor >= 2.5) {
			phase = "hold";
			note = "search";
			live.search = true;
		} else live.search = false;
	} else {
		live.search = false;
		live.lostFor = 0;
	}
	const outside = Math.hypot(craft.x, craft.z) > world.fence;
	if (live.battery < 20 || outside) {
		if (distPad < 2.15) phase = "land";
		else phase = "rtl";
		note = live.battery < 20 ? "battery" : "geofence";
		live.search = false;
	}
	live.command = phase;
	live.note = note;
	live.alt = craft.y;
	const row = {
		text,
		mark: "unmarked",
		map: world.id,
		runId: live.runId
	};
	live.rows.push(row);
	if (live.rows.length > 800) live.rows.splice(0, live.rows.length - 800);
	live.logAcc += .1;
	if (live.log[0]?.cmd !== phase || live.log[0]?.model !== asked.phase || live.logAcc >= 1) {
		live.logAcc = 0;
		pushLog(note);
	}
}
function pushLog(note) {
	live.log = [{
		t: live.t,
		model: `${live.modelPhase}`,
		rules: `${live.rulesPhase}`,
		cmd: live.command,
		threat: live.threat ? "yes" : "no",
		see: live.see ? "yes" : "no",
		clearance: live.clearance,
		note
	}, ...live.log].slice(0, 40);
}
function activeGoal(config) {
	if (live.command === "rtl" || live.note === "target lost" || live.note === "battery" || live.note === "geofence") return config.world.home;
	if (config.modeKind === "track" && live.target && live.command !== "land") return live.target;
	return live.goals[live.goalIndex] ?? config.world.home;
}
function landingPoint(config) {
	if (config.modeKind === "track") return config.world.home;
	const last = live.goals[live.goals.length - 1];
	if ((live.command === "rtl" || live.note === "battery" || live.note === "geofence") && live.goalIndex <= 0 && live.command === "rtl") return config.world.home;
	if (live.command === "rtl" || live.note === "battery" || live.note === "geofence" || live.note === "target lost") return config.world.home;
	return last ?? config.world.home;
}
function trackPoint(config, t) {
	const home = config.world.home;
	const anchor = config.anchor ?? {
		x: home.x + 8,
		y: config.trackTarget === "drone" ? 5 : .3,
		z: home.z + 22
	};
	const y = config.trackTarget === "drone" ? Math.max(4, anchor.y) : .35;
	if (config.pattern === "shuttle") {
		const u = (Math.sin(t * .45) + 1) / 2;
		return {
			x: anchor.x - 10 + u * 28,
			y,
			z: anchor.z
		};
	}
	if (config.pattern === "patrol") return {
		x: anchor.x + Math.sin(t * .45) * 14,
		y,
		z: anchor.z + Math.sin(t * .9) * 8
	};
	const blocker = coverPoint(config.world, anchor);
	const p = t % 12;
	if (p < 4.5) return {
		x: anchor.x + p / 4.5 * (blocker.x - anchor.x) * .45,
		y,
		z: anchor.z + p / 4.5 * (blocker.z - anchor.z) * .45
	};
	return {
		x: blocker.x,
		y: config.trackTarget === "drone" ? Math.min(y, blocker.y) : .35,
		z: blocker.z
	};
}
function coverPoint(world, from) {
	if (world.biome === "woods" && world.trees[0]) {
		const tree = world.trees[3] ?? world.trees[0];
		return {
			x: tree.x + 1.2,
			y: 1,
			z: tree.z + 1.4
		};
	}
	if (world.biome === "desert" && world.ridge) return {
		x: world.ridge.x + 6,
		y: 1,
		z: world.ridge.z - world.ridge.d * .6
	};
	const b = world.buildings[2] ?? world.buildings[0];
	if (b) return {
		x: b.x,
		y: .4,
		z: b.z + b.d * .55
	};
	return {
		x: from.x + 12,
		y: .4,
		z: from.z + 8
	};
}
function opposedActors(config, t) {
	const a = config.goals[0] ?? config.world.home;
	const b = config.goals[Math.min(1, config.goals.length - 1)] ?? {
		x: a.x + 18,
		y: 4,
		z: a.z + 18
	};
	const mx = (a.x + b.x) / 2;
	const mz = (a.z + b.z) / 2;
	return [
		{
			x: mx + 3.5,
			y: 1.2,
			z: mz,
			r: 1.7,
			kind: "hazard",
			h: 2.4
		},
		{
			x: mx - 5,
			y: 1,
			z: mz + 4,
			r: 1.5,
			kind: "hazard",
			h: 2
		},
		{
			x: mx + Math.sin(t * .7) * 7,
			y: 5,
			z: mz + 6,
			r: 1.3,
			kind: "drone",
			h: .6
		},
		{
			x: mx - 8,
			y: 6.5,
			z: mz + Math.cos(t * .55) * 7,
			r: 1.3,
			kind: "drone",
			h: .6
		}
	];
}
function nearestObs(craft, world, actors) {
	let best = {
		kind: "none",
		gap: 30,
		x: craft.x,
		z: craft.z
	};
	const consider = (kind, x, z, r, top) => {
		const gap = Math.max(0, Math.hypot(craft.x - x, craft.z - z) - r);
		if (gap > 16) return;
		if (craft.y > top + 2.2) return;
		if (gap < best.gap) best = {
			kind,
			gap,
			x,
			z
		};
	};
	for (const b of world.buildings) {
		const hx = b.w / 2;
		const hz = b.d / 2;
		const dx = Math.max(Math.abs(craft.x - b.x) - hx, 0);
		const dz = Math.max(Math.abs(craft.z - b.z) - hz, 0);
		const gap = Math.hypot(dx, dz);
		if (gap < best.gap && gap < 16 && craft.y < b.h + 1.5) best = {
			kind: "roof",
			gap,
			x: b.x,
			z: b.z
		};
	}
	for (const tree of world.trees) consider(tree.lethal ? "trunk" : "tree", tree.x, tree.z, tree.r, tree.trunkH);
	for (const rock of world.rocks) consider("rock", rock.x, rock.z, rock.s, rock.s);
	if (world.ridge) {
		const b = world.ridge;
		const dx = Math.max(Math.abs(craft.x - b.x) - b.w / 2, 0);
		const dz = Math.max(Math.abs(craft.z - b.z) - b.d / 2, 0);
		const gap = Math.hypot(dx, dz);
		if (gap < best.gap && gap < 16 && craft.y < b.h + 1.2) best = {
			kind: "ridge",
			gap,
			x: b.x,
			z: b.z
		};
	}
	for (const w of world.wires) consider("wire", (w.ax + w.bx) / 2, (w.az + w.bz) / 2, .4, Math.max(w.ay, w.by));
	for (const a of actors) consider(a.kind, a.x, a.z, a.r, a.y + a.h);
	return best;
}
function canSee(craft, goal, world, actors) {
	const fx = -Math.sin(craft.yaw);
	const fz = -Math.cos(craft.yaw);
	const dx = goal.x - craft.x;
	const dz = goal.z - craft.z;
	const dist = Math.hypot(dx, dz);
	if (dist < .8) return true;
	if (dx / dist * fx + dz / dist * fz < .45) return false;
	if (blocked(craft.x, craft.y, craft.z, goal.x, goal.y + .2, goal.z, world, actors)) return false;
	return true;
}
function blocked(ax, ay, az, bx, by, bz, world, actors) {
	const dx = bx - ax;
	const dy = by - ay;
	const dz = bz - az;
	const dist = Math.hypot(dx, dy, dz) || 1;
	for (const tree of world.trees) {
		const hit = rayCylinder(ax, az, dx, dz, tree.x, tree.z, tree.r + .3, dist);
		if (hit == null) continue;
		if (ay + dy * (hit / dist) < tree.trunkH) return true;
	}
	for (const b of world.buildings) if (rayAabb(ax, ay, az, dx, dy, dz, b.x, b.h / 2, b.z, b.w / 2, b.h / 2, b.d / 2, dist)) return true;
	if (world.ridge) {
		const b = world.ridge;
		if (rayAabb(ax, ay, az, dx, dy, dz, b.x, b.y, b.z, b.w / 2, b.h / 2, b.d / 2, dist)) return true;
	}
	for (const a of actors) {
		const hit = rayCylinder(ax, az, dx, dz, a.x, a.z, a.r, dist);
		if (hit != null) {
			const y = ay + dy * (hit / dist);
			if (Math.abs(y - a.y) < a.h + .8) return true;
		}
	}
	return false;
}
function rayCylinder(ax, az, dx, dz, cx, cz, r, max) {
	const fx = ax - cx;
	const fz = az - cz;
	const a = dx * dx + dz * dz;
	if (a < 1e-6) return null;
	const b = 2 * (fx * dx + fz * dz);
	const c = fx * fx + fz * fz - r * r;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	const t1 = (-b - s) / (2 * a);
	const t2 = (-b + s) / (2 * a);
	const t = t1 > .05 ? t1 : t2;
	if (t > .05 && t < .98) return t * max;
	return null;
}
function rayAabb(ax, ay, az, dx, dy, dz, cx, cy, cz, hx, hy, hz, max) {
	const inv = (v) => Math.abs(v) < 1e-8 ? 1e8 * Math.sign(v || 1) : 1 / v;
	const minx = cx - hx;
	const maxx = cx + hx;
	let t1 = (minx - ax) * inv(dx);
	let t2 = (maxx - ax) * inv(dx);
	let tmin = Math.min(t1, t2);
	let tmax = Math.max(t1, t2);
	t1 = (cy - hy - ay) * inv(dy);
	t2 = (cy + hy - ay) * inv(dy);
	tmin = Math.max(tmin, Math.min(t1, t2));
	tmax = Math.min(tmax, Math.max(t1, t2));
	t1 = (cz - hz - az) * inv(dz);
	t2 = (cz + hz - az) * inv(dz);
	tmin = Math.max(tmin, Math.min(t1, t2));
	tmax = Math.min(tmax, Math.max(t1, t2));
	return tmax >= Math.max(tmin, .02) && tmin < .98 && tmin * max < max;
}
function avoidDir(dirx, dirz, craft, world, actors, mode) {
	let x = dirx;
	let z = dirz;
	const push = (ox, oz, reach) => {
		const dx = craft.x - ox;
		const dz = craft.z - oz;
		const d = Math.hypot(dx, dz);
		if (d < reach && d > .05) {
			const s = (reach - d) / reach * (mode === "thread" ? 2.4 : 1.8);
			x += dx / d * s;
			z += dz / d * s;
		}
	};
	for (const tree of world.trees) push(tree.x, tree.z, tree.r + (mode === "thread" ? 4.8 : 2.2));
	for (const rock of world.rocks) push(rock.x, rock.z, rock.s + 2);
	if (world.ridge) push(world.ridge.x, world.ridge.z, 8);
	for (const a of actors) push(a.x, a.z, a.r + 3.2);
	const n = Math.hypot(x, z);
	if (n < .001) return {
		x: dirx,
		z: dirz
	};
	return {
		x: x / n,
		z: z / n
	};
}
function resolveBuildings(craft, world) {
	for (const b of world.buildings) {
		if (craft.y >= b.h + .25) continue;
		const hx = b.w / 2 + .45;
		const hz = b.d / 2 + .45;
		const dx = craft.x - b.x;
		const dz = craft.z - b.z;
		if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
			const px = hx - Math.abs(dx);
			const pz = hz - Math.abs(dz);
			if (px < pz) craft.x += Math.sign(dx || 1) * px;
			else craft.z += Math.sign(dz || 1) * pz;
		}
	}
	if (world.ridge && craft.y < world.ridge.h + .3) {
		const b = world.ridge;
		const hx = b.w / 2 + .4;
		const hz = b.d / 2 + .4;
		const dx = craft.x - b.x;
		const dz = craft.z - b.z;
		if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
			const px = hx - Math.abs(dx);
			const pz = hz - Math.abs(dz);
			if (px < pz) craft.x += Math.sign(dx || 1) * px;
			else craft.z += Math.sign(dz || 1) * pz;
		}
	}
}
function resolveSolids(craft, actors) {
	for (const a of actors) {
		const dx = craft.x - a.x;
		const dz = craft.z - a.z;
		const d = Math.hypot(dx, dz);
		const min = a.r + .55;
		if (d < min && Math.abs(craft.y - a.y) < a.h + .8) {
			const n = d || .001;
			craft.x = a.x + dx / n * min;
			craft.z = a.z + dz / n * min;
		}
	}
}
function publishGps() {
	const world = live.world;
	const craft = live.craft;
	live.east = craft.x - (world?.home.x ?? 0);
	live.north = craft.z - (world?.home.z ?? 0);
	live.alt = craft.y;
	if (!world || !live.gpsOn) {
		live.lat = 0;
		live.lon = 0;
		return;
	}
	const lat = world.origin.lat + craft.z / 111320;
	const lon = world.origin.lon + craft.x / (111320 * Math.cos(world.origin.lat * Math.PI / 180));
	live.lat = lat;
	live.lon = lon;
}
function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
function wrap(a) {
	while (a > Math.PI) a -= Math.PI * 2;
	while (a < -Math.PI) a += Math.PI * 2;
	return a;
}
function sampleGoals(world, modeKind, user, anchor) {
	if (modeKind === "track") return [];
	if (user.length) return user.map((p) => ({ ...p }));
	if (modeKind === "thread" && world.thread.length) return world.thread.map((p) => ({ ...p }));
	return world.sample.map((p) => ({ ...p }));
}
function installProbe() {
	if (typeof window === "undefined") return;
	window.__controlsTest = {
		getYaw: () => live.craft.yaw,
		getSpeed: () => Math.hypot(live.craft.vx, live.craft.vz),
		setKeys: (codes) => {
			keys.clear();
			for (const c of codes) keys.add(c);
		},
		setSteer: (v) => {
			live.steerOverride = v;
		}
	};
	window.__moka = {
		ready: true,
		phase: () => live.command,
		status: () => live.status,
		pilot: () => live.pilotLabel,
		rows: () => live.rows.length,
		fail: () => live.failReason
	};
}
function Viewport({ world, points, pilotCam, onPick }) {
	const hostRef = (0, import_react.useRef)(null);
	const fpvHostRef = (0, import_react.useRef)(null);
	const pointsRef = (0, import_react.useRef)(points);
	const pickRef = (0, import_react.useRef)(onPick);
	const pilotRef = (0, import_react.useRef)(pilotCam);
	pointsRef.current = points;
	pickRef.current = onPick;
	pilotRef.current = pilotCam;
	(0, import_react.useEffect)(() => {
		const host = hostRef.current;
		const fpvHost = fpvHostRef.current;
		if (!host || !fpvHost) return;
		const scene = new Scene();
		scene.background = new Color(world.sky);
		scene.fog = new Fog(world.fog, 28, world.biome === "desert" ? 150 : 110);
		const camera = new PerspectiveCamera(52, 1, .1, 240);
		const renderer = new WebGLRenderer({
			antialias: false,
			powerPreference: "high-performance"
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		renderer.shadowMap.enabled = false;
		renderer.outputColorSpace = SRGBColorSpace;
		renderer.domElement.className = "h-full w-full";
		host.appendChild(renderer.domElement);
		const fpvCam = new PerspectiveCamera(76, 220 / 132, .08, 180);
		const fpv = new WebGLRenderer({ antialias: false });
		fpv.setPixelRatio(1);
		fpv.setSize(220, 132, false);
		fpv.shadowMap.enabled = false;
		fpv.outputColorSpace = SRGBColorSpace;
		fpv.domElement.className = "h-full w-full";
		fpvHost.appendChild(fpv.domElement);
		scene.add(new HemisphereLight(15922410, 3817524, 1.15));
		const sun = new DirectionalLight(16774360, 1.05);
		sun.position.set(-30, 50, 20);
		scene.add(sun);
		const disposables = [];
		const groundTex = groundTexture(world.biome);
		disposables.push(groundTex);
		const ground = new Mesh(new PlaneGeometry(180, 180), new MeshLambertMaterial({
			map: groundTex,
			color: world.ground
		}));
		ground.rotation.x = -Math.PI / 2;
		scene.add(ground);
		if (world.park) {
			const p = world.park;
			const mesh = new Mesh(new PlaneGeometry(p.w, p.d), new MeshLambertMaterial({ color: 1984052 }));
			mesh.rotation.x = -Math.PI / 2;
			mesh.position.set(p.x, .03, p.z);
			scene.add(mesh);
		}
		if (world.streamZ != null) {
			const water = new Mesh(new PlaneGeometry(130, 4.2), new MeshLambertMaterial({ color: 4025976 }));
			water.rotation.x = -Math.PI / 2;
			water.position.set(0, .04, world.streamZ);
			scene.add(water);
		}
		const pick = [ground];
		if (world.buildings.length) {
			const geo = new BoxGeometry(1, 1, 1);
			const mat = new MeshLambertMaterial({ map: windowTexture() });
			disposables.push(geo, mat, mat.map);
			const mesh = new InstancedMesh(geo, mat, world.buildings.length);
			const dummy = new Object3D();
			const color = new Color();
			world.buildings.forEach((b, i) => {
				dummy.position.set(b.x, b.y, b.z);
				dummy.scale.set(b.w, b.h, b.d);
				dummy.updateMatrix();
				mesh.setMatrixAt(i, dummy.matrix);
				color.setHex(b.tint);
				mesh.setColorAt(i, color);
			});
			mesh.instanceColor && (mesh.instanceColor.needsUpdate = true);
			scene.add(mesh);
			pick.push(mesh);
		}
		if (world.trees.length) {
			const trunkGeo = new CylinderGeometry(1, 1.05, 1, 6);
			const canopyGeo = new SphereGeometry(1, 7, 5);
			const trunkMat = new MeshLambertMaterial({ color: 4863012 });
			const canopyMat = new MeshLambertMaterial({ color: world.biome === "city" ? 3107397 : 2054712 });
			const trunks = new InstancedMesh(trunkGeo, trunkMat, world.trees.length);
			const caps = new InstancedMesh(canopyGeo, canopyMat, world.trees.length);
			const dummy = new Object3D();
			world.trees.forEach((t, i) => {
				dummy.position.set(t.x, t.trunkH / 2, t.z);
				dummy.scale.set(t.r, t.trunkH, t.r);
				dummy.updateMatrix();
				trunks.setMatrixAt(i, dummy.matrix);
				dummy.position.set(t.x, t.trunkH + t.canopy * .45, t.z);
				dummy.scale.set(t.canopy, t.canopy * .7, t.canopy);
				dummy.updateMatrix();
				caps.setMatrixAt(i, dummy.matrix);
			});
			scene.add(trunks, caps);
			disposables.push(trunkGeo, canopyGeo, trunkMat, canopyMat);
		}
		if (world.rocks.length) {
			const geo = new DodecahedronGeometry(1, 0);
			const mat = new MeshLambertMaterial({ color: 9270108 });
			const mesh = new InstancedMesh(geo, mat, world.rocks.length);
			const dummy = new Object3D();
			world.rocks.forEach((r, i) => {
				dummy.position.set(r.x, r.s * .45, r.z);
				dummy.scale.setScalar(r.s);
				dummy.rotation.y = r.x;
				dummy.updateMatrix();
				mesh.setMatrixAt(i, dummy.matrix);
			});
			scene.add(mesh);
			disposables.push(geo, mat);
		}
		if (world.ridge) {
			const b = world.ridge;
			const mesh = new Mesh(new BoxGeometry(b.w, b.h, b.d), new MeshLambertMaterial({ color: b.tint }));
			mesh.position.set(b.x, b.y, b.z);
			scene.add(mesh);
		}
		if (world.wires.length) {
			const pts = [];
			for (const w of world.wires) pts.push(w.ax, w.ay, w.az, w.bx, w.by, w.bz);
			const geo = new BufferGeometry();
			geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
			const line = new LineSegments(geo, new LineBasicMaterial({ color: 7240840 }));
			scene.add(line);
			disposables.push(geo);
		}
		const pad = new Mesh(new CylinderGeometry(1.3, 1.3, .08, 16), new MeshBasicMaterial({ color: 14086746 }));
		pad.position.set(world.home.x, world.home.y + .05, world.home.z);
		scene.add(pad);
		const ring = new Mesh(new TorusGeometry(1.7, .06, 6, 18), new MeshBasicMaterial({ color: 14086746 }));
		ring.rotation.x = Math.PI / 2;
		ring.position.copy(pad.position);
		scene.add(ring);
		const craft = makeDrone(2304035, 14086746);
		const other = makeDrone(6962466, 15114588);
		other.group.visible = false;
		scene.add(craft.group, other.group);
		const marker = new Mesh(new CylinderGeometry(.7, .7, .12, 14), new MeshBasicMaterial({ color: 15114588 }));
		marker.visible = false;
		scene.add(marker);
		const actorMat = new MeshLambertMaterial({ color: 9062962 });
		const actorGeo = new CylinderGeometry(1, 1, 1, 8);
		const actorMeshes = [
			0,
			1,
			2,
			3
		].map(() => {
			const m = new Mesh(actorGeo, actorMat);
			m.visible = false;
			scene.add(m);
			return m;
		});
		const poleGeo = new CylinderGeometry(.08, .08, 1, 5);
		const poleMat = new MeshBasicMaterial({ color: 14086746 });
		const poles = Array.from({ length: 8 }, () => {
			const m = new Mesh(poleGeo, poleMat);
			m.visible = false;
			scene.add(m);
			return m;
		});
		const raycaster = new Raycaster();
		const pointer = new Vector2();
		const onPointer = (ev) => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.x = (ev.clientX - rect.left) / rect.width * 2 - 1;
			pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);
			const hit = raycaster.intersectObjects(pick, false)[0];
			if (!hit) return;
			pickRef.current({
				x: hit.point.x,
				y: Math.max(.3, hit.point.y),
				z: hit.point.z
			});
		};
		renderer.domElement.addEventListener("pointerdown", onPointer);
		const desired = new Vector3();
		const look = new Vector3();
		let last = performance.now();
		let acc = 0;
		let frame = 0;
		const loop = (now) => {
			const dt = Math.min(.05, (now - last) / 1e3);
			last = now;
			acc += dt;
			while (acc >= 1 / 60) {
				tick(1 / 60);
				acc -= 1 / 60;
			}
			const c = live.craft;
			const yaw = c.yaw;
			const fx = -Math.sin(yaw);
			const fz = -Math.cos(yaw);
			craft.group.position.set(c.x, c.y, c.z);
			craft.group.rotation.y = yaw + Math.PI;
			const spin = live.status === "running" ? 28 : 4;
			for (const r of craft.rotors) r.rotation.z += dt * spin;
			if (live.target) {
				if (live.config?.trackTarget === "drone") {
					other.group.visible = true;
					marker.visible = false;
					other.group.position.set(live.target.x, live.target.y, live.target.z);
					for (const r of other.rotors) r.rotation.z += dt * 22;
				} else {
					other.group.visible = false;
					marker.visible = true;
					marker.position.set(live.target.x, .2, live.target.z);
				}
			} else {
				other.group.visible = false;
				marker.visible = false;
			}
			live.actors.forEach((a, i) => {
				const m = actorMeshes[i];
				if (!m) return;
				m.visible = true;
				m.position.set(a.x, a.y, a.z);
				m.scale.set(a.r, a.h, a.r);
			});
			for (let i = live.actors.length; i < actorMeshes.length; i++) {
				const m = actorMeshes[i];
				if (m) m.visible = false;
			}
			const pts = live.status === "running" ? live.goals : pointsRef.current;
			poles.forEach((pole, i) => {
				const p = pts[i];
				if (!p) {
					pole.visible = false;
					return;
				}
				pole.visible = true;
				pole.position.set(p.x, p.y + .7, p.z);
				pole.scale.set(1, 1.4, 1);
			});
			desired.set(c.x - fx * 8.2, c.y + 3.1, c.z - fz * 8.2);
			camera.position.lerp(desired, 1 - Math.exp(-4 * dt));
			look.set(c.x, c.y + .4, c.z);
			camera.lookAt(look);
			renderer.render(scene, camera);
			frame += 1;
			if (pilotRef.current && frame % 2 === 0) {
				fpvCam.position.set(c.x + fx * .42, c.y + .06, c.z + fz * .42);
				fpvCam.lookAt(c.x + fx * 14, c.y - .35, c.z + fz * 14);
				fpv.render(scene, fpvCam);
			}
			if (frame % 6 === 0) refreshHud();
		};
		renderer.setAnimationLoop(loop);
		const resize = () => {
			const w = host.clientWidth || 1;
			const h = host.clientHeight || 1;
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		return () => {
			renderer.setAnimationLoop(null);
			renderer.domElement.removeEventListener("pointerdown", onPointer);
			ro.disconnect();
			renderer.dispose();
			fpv.dispose();
			host.removeChild(renderer.domElement);
			if (fpv.domElement.parentElement === fpvHost) fpvHost.removeChild(fpv.domElement);
			scene.traverse((obj) => {
				const mesh = obj;
				if (mesh.geometry) mesh.geometry.dispose();
				const material = mesh.material;
				if (Array.isArray(material)) material.forEach((m) => m.dispose());
				else material?.dispose();
			});
			disposables.forEach((d) => d.dispose());
		};
	}, [world]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: hostRef,
			className: "absolute inset-0 touch-none"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: pilotCam ? "absolute right-3 bottom-3 z-10 h-36 w-56" : "hidden",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: fpvHostRef,
				className: "h-full w-full overflow-hidden rounded-md border border-beam bg-bg"
			}), pilotCam ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhaseTag, {}) : null]
		})]
	});
}
function PhaseTag() {
	(0, import_react.useSyncExternalStore)(subscribe, getVersion, getVersion);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "pointer-events-none absolute top-1 left-2 font-mono text-xs text-beam",
		children: [
			"phase ",
			live.command,
			live.note ? ` · ${live.note}` : ""
		]
	});
}
function groundTexture(biome) {
	const c = document.createElement("canvas");
	c.width = 256;
	c.height = 256;
	const g = c.getContext("2d");
	if (!g) return new CanvasTexture(c);
	if (biome === "city") {
		g.fillStyle = "#1a1e24";
		g.fillRect(0, 0, 256, 256);
		g.strokeStyle = "#3a414c";
		g.lineWidth = 10;
		for (let i = 16; i < 256; i += 42) {
			g.beginPath();
			g.moveTo(i, 0);
			g.lineTo(i, 256);
			g.moveTo(0, i);
			g.lineTo(256, i);
			g.stroke();
		}
	} else if (biome === "woods") {
		g.fillStyle = "#1c2a20";
		g.fillRect(0, 0, 256, 256);
		for (let i = 0; i < 80; i++) {
			g.fillStyle = i % 2 ? "#243628" : "#18241c";
			g.fillRect(i * 47 % 256, i * 29 % 256, 18, 10);
		}
	} else {
		g.fillStyle = "#c9a36e";
		g.fillRect(0, 0, 256, 256);
		for (let i = 0; i < 70; i++) {
			g.fillStyle = i % 2 ? "#d8b483" : "#b89260";
			g.fillRect(i * 53 % 256, i * 31 % 256, 14, 8);
		}
	}
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.wrapS = tex.wrapT = RepeatWrapping;
	tex.repeat.set(6, 6);
	return tex;
}
function windowTexture() {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const g = c.getContext("2d");
	if (!g) return new CanvasTexture(c);
	g.fillStyle = "#243140";
	g.fillRect(0, 0, 64, 64);
	for (let y = 6; y < 60; y += 14) for (let x = 5; x < 60; x += 12) {
		g.fillStyle = (x + y) % 24 === 0 ? "#e6b15a" : "#15202b";
		g.fillRect(x, y, 7, 8);
	}
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.magFilter = NearestFilter;
	return tex;
}
function makeDrone(body, nose) {
	const group = new Group();
	const hull = new Mesh(new BoxGeometry(.36, .1, .5), new MeshLambertMaterial({ color: body }));
	group.add(hull);
	group.add(new Mesh(new BoxGeometry(.7, .035, .06), new MeshLambertMaterial({ color: 1710618 })));
	const armB = new Mesh(new BoxGeometry(.06, .035, .7), new MeshLambertMaterial({ color: 1710618 }));
	group.add(armB);
	const rotors = [];
	const geo = new CircleGeometry(.16, 8);
	const mat = new MeshBasicMaterial({
		color: 12042926,
		side: 2
	});
	for (const [x, z] of [
		[.3, .3],
		[.3, -.3],
		[-.3, .3],
		[-.3, -.3]
	]) {
		const r = new Mesh(geo, mat);
		r.rotation.x = -Math.PI / 2;
		r.position.set(x, .07, z);
		group.add(r);
		rotors.push(r);
	}
	const cam = new Mesh(new BoxGeometry(.1, .07, .1), new MeshBasicMaterial({ color: nose }));
	cam.position.set(0, .02, .28);
	group.add(cam);
	return {
		group,
		rotors
	};
}
var FAIL_KEY = "moka-beam-failed";
var ROW_KEY = "moka-beam-rows";
var ORDER = {
	hardware: [
		"pi5-8gb",
		"pi4-4gb",
		"jetson"
	],
	drones: [
		"fpv-quad",
		"wing",
		"rover"
	],
	maps: [
		"corvid",
		"heron",
		"falcon"
	],
	modes: [
		"track",
		"a-to-b",
		"a-to-b-opposed",
		"thread"
	],
	models: [
		"rules",
		"moka-flight",
		"typed"
	]
};
function sortBy(list, key) {
	const pref = ORDER[key] ?? [];
	return [...list].sort((a, b) => {
		const ia = pref.indexOf(a.id);
		const ib = pref.indexOf(b.id);
		if (ia === -1 && ib === -1) return a.id.localeCompare(b.id);
		if (ia === -1) return 1;
		if (ib === -1) return -1;
		return ia - ib;
	});
}
function SimScreen({ initial }) {
	const [catalog, setCatalog] = (0, import_react.useState)(initial);
	const [hardwareId, setHardwareId] = (0, import_react.useState)("pi5-8gb");
	const [droneId, setDroneId] = (0, import_react.useState)("fpv-quad");
	const [mapId, setMapId] = (0, import_react.useState)("corvid");
	const [modeId, setModeId] = (0, import_react.useState)("a-to-b");
	const [pilotId, setPilotId] = (0, import_react.useState)("rules");
	const [targetKind, setTargetKind] = (0, import_react.useState)("marker");
	const [pattern, setPattern] = (0, import_react.useState)("shuttle");
	const [waypoints, setWaypoints] = (0, import_react.useState)([]);
	const [anchor, setAnchor] = (0, import_react.useState)(null);
	const [pilotCam, setPilotCam] = (0, import_react.useState)(false);
	const [gpsOn, setGpsOn] = (0, import_react.useState)(true);
	const [trainName, setTrainName] = (0, import_react.useState)("moka-beam-corvid-1");
	const [nameDirty, setNameDirty] = (0, import_react.useState)(false);
	const [training, setTraining] = (0, import_react.useState)(false);
	const [report, setReport] = (0, import_react.useState)(null);
	const [addMsg, setAddMsg] = (0, import_react.useState)("");
	(0, import_react.useSyncExternalStore)(subscribe, getVersion, getVersion);
	const hardware = sortBy(catalog.hardware, "hardware");
	const drones = sortBy(catalog.drones, "drones");
	const maps = sortBy(catalog.maps, "maps");
	const modes = sortBy(catalog.modes, "modes");
	const models = sortBy(catalog.models, "models");
	const map = maps.find((m) => m.id === mapId) ?? maps[0];
	const mode = modes.find((m) => m.id === modeId) ?? modes[0];
	const model = models.find((m) => m.id === pilotId) ?? models.find((m) => m.id === "rules");
	const world = (0, import_react.useMemo)(() => map ? buildWorld(map) : null, [map]);
	const gpsRef = (0, import_react.useRef)(gpsOn);
	gpsRef.current = gpsOn;
	const running = live.status === "running";
	(0, import_react.useEffect)(() => {
		installProbe();
		setCatalog(mergeFailed(initial));
		try {
			const raw = localStorage.getItem(ROW_KEY);
			if (raw) {
				const rows = JSON.parse(raw);
				if (Array.isArray(rows)) live.rows = rows.slice(-800);
			}
		} catch {}
		const down = (e) => {
			if (typing(e)) return;
			keys.add(e.code);
		};
		const up = (e) => keys.delete(e.code);
		const blur = () => keys.clear();
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", blur);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", blur);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!world || live.status === "running") return;
		placeOnPad(world);
		live.gpsOn = gpsRef.current;
	}, [world]);
	(0, import_react.useEffect)(() => {
		if (nameDirty) return;
		const n = models.filter((m) => m.id.startsWith(`moka-beam-${mapId}`)).length + 1;
		setTrainName(`moka-beam-${mapId}-${n}`);
	}, [
		mapId,
		models,
		nameDirty
	]);
	function onPick(point) {
		if (live.status === "running") return;
		if (mode?.kind === "track") setAnchor(point);
		else setWaypoints((w) => [...w, point].slice(0, 8));
	}
	async function onRun() {
		if (!world || !mode || !model || running) return;
		if (!model.enabled || model.failed) return;
		const ask = pilotFor(await hydrateModel(model));
		const goals = sampleGoals(world, mode.kind, waypoints, anchor);
		arm({
			mapId: world.id,
			modeKind: mode.kind,
			world,
			goals,
			trackTarget: targetKind,
			pattern,
			anchor,
			ask
		});
		live.gpsOn = gpsOn;
	}
	async function onTrain() {
		if (training || !map) return;
		setTraining(true);
		setAddMsg("");
		try {
			persistRows();
			const result = await trainStudentBundle({
				name: trainName,
				mapId: map.id,
				recorded: live.rows,
				taken: models.map((m) => m.id)
			});
			setReport(result);
			if (result.passed && result.model) setCatalog((c) => ({
				...c,
				models: [...c.models.filter((m) => m.id !== result.id), result.model]
			}));
			else if (result.model) {
				const failed = result.model;
				const next = rememberFailed(failed);
				setCatalog((c) => ({
					...c,
					models: mergeModels(c.models, next)
				}));
				setPilotId("rules");
			}
		} catch (err) {
			setAddMsg(err instanceof Error ? err.message : "Train failed");
		} finally {
			setTraining(false);
		}
	}
	async function onAdd(files) {
		if (!files || files.length === 0) return;
		setAddMsg("Reading bundle…");
		try {
			const bag = /* @__PURE__ */ new Map();
			const first = files[0];
			if (files.length === 1 && first && first.name.toLowerCase().endsWith(".zip")) {
				const unpacked = unzipSync(new Uint8Array(await first.arrayBuffer()));
				for (const [name, data] of Object.entries(unpacked)) bag.set(name.split("/").pop() ?? name, data);
			} else for (const file of files) {
				const rel = file.webkitRelativePath || file.name;
				bag.set(rel.split("/").pop() ?? file.name, new Uint8Array(await file.arrayBuffer()));
			}
			const configBytes = bag.get("moka_config.json");
			const onnx = bag.get("model.onnx");
			const tokenizerName = [...bag.keys()].find((n) => /tokenizer|vocab/i.test(n));
			if (!configBytes || !onnx || !tokenizerName) {
				setAddMsg("Need model.onnx, a tokenizer, and moka_config.json.");
				return;
			}
			const config = JSON.parse(new TextDecoder().decode(configBytes));
			const id = slug(config.id || config.name || "typed");
			const huge = onnx.byteLength > 15e5;
			const payload = [];
			for (const [name, data] of bag) {
				if (huge && name === "model.onnx") continue;
				if (data.byteLength > 15e5) continue;
				payload.push({
					name,
					base64: toB64(data)
				});
			}
			await addModelFolder({ data: {
				id,
				files: payload
			} });
			const fresh = mergeFailed(await getCatalog());
			setCatalog(fresh);
			setAddMsg(huge || config.kind === "laya" ? "Bundle noted. Not a flight pilot. Laya weights are not loaded." : `Added models/${id}`);
		} catch (err) {
			setAddMsg(err instanceof Error ? err.message : "Could not add that bundle");
		}
	}
	const lessons = rowCount(live.rows);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh lg:overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3 border-b border-muted/30 px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs tracking-widest text-beam",
					children: "LOCAL MISSION SIM"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-3xl leading-none font-semibold tracking-wide text-balance",
					children: "Moka-beam"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-md font-mono text-xs text-muted text-pretty",
					children: "You pick the board, the craft, the map, the mode, and the pilot. The pilot only names the next phase."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1 flex-col lg:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "order-2 flex max-h-[70dvh] flex-col gap-4 overflow-y-auto border-muted/30 px-4 py-3 lg:order-1 lg:max-h-none lg:w-80 lg:shrink-0 lg:border-r",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Picker, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "size-4" }),
							title: "Hardware",
							locked: running,
							items: hardware.map((h) => ({
								id: h.id,
								label: h.name,
								detail: `${h.ram_gb} GB`,
								enabled: h.enabled
							})),
							selected: hardwareId,
							onSelect: setHardwareId
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Picker, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plane, { className: "size-4" }),
							title: "Drone",
							locked: running,
							items: drones.map((d) => ({
								id: d.id,
								label: d.name,
								detail: d.camera,
								enabled: d.enabled
							})),
							selected: droneId,
							onSelect: setDroneId
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Picker, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "size-4" }),
							title: "Map",
							locked: running,
							items: maps.map((m) => ({
								id: m.id,
								label: m.bird,
								detail: `${m.biome} · ${m.home_pad.label ?? "pad"}`,
								enabled: m.enabled
							})),
							selected: mapId,
							onSelect: (id) => {
								setMapId(id);
								setWaypoints([]);
								setAnchor(null);
							}
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Picker, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, { className: "size-4" }),
							title: "Mode",
							locked: running,
							items: modes.map((m) => ({
								id: m.id,
								label: m.name,
								detail: m.summary,
								enabled: m.enabled
							})),
							selected: modeId,
							onSelect: setModeId
						}),
						mode?.kind === "track" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
									label: "Target",
									value: targetKind,
									options: [["marker", "Ground marker"], ["drone", "Second drone"]],
									disabled: running,
									onChange: (v) => setTargetKind(v)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
									label: "Pattern",
									value: pattern,
									options: [
										["shuttle", "Shuttle"],
										["patrol", "Patrol"],
										["break", "Break"]
									],
									disabled: running,
									onChange: (v) => setPattern(v)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-xs text-muted",
									children: [anchor ? "Pattern placed. Click the map to move it." : "Click the map to place the pattern.", " Lose the target and it holds, searches, then returns."]
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-xs text-muted text-pretty",
									children: mode?.kind === "thread" ? "Meant for Heron. Click a thread, or run the sample gaps. A trunk ends the run." : mode?.kind === "opposed" ? "Click waypoints. Other drones and hazards only block space. No weapons." : "Click waypoints. The craft flies them in order and lands on the last. Empty uses a sample leg."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-2",
									children: waypoints.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-xs text-fg",
										children: [
											i + 1,
											" ",
											p.x.toFixed(0),
											",",
											p.z.toFixed(0)
										]
									}, `${p.x}-${p.z}-${i}`))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-11 rounded-md border border-muted/40 px-3 text-left text-sm text-muted",
									disabled: running || waypoints.length === 0,
									onClick: () => setWaypoints([]),
									children: "Clear points"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "flex items-center gap-2 font-mono text-xs tracking-widest text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brain, { className: "size-4" }), " Pilot"]
								}),
								models.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: !m.enabled || running,
									onClick: () => setPilotId(m.id),
									className: rowClass(pilotId === m.id, m.enabled),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-lg leading-tight",
										children: m.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "block font-mono text-xs text-muted",
										children: [
											m.kind,
											m.badge ? ` · ${m.badge}` : "",
											m.failed ? " · failed" : ""
										]
									})]
								}, m.id)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "grid gap-1 font-mono text-xs text-muted",
									children: ["Student name", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: trainName,
										disabled: training || running,
										onChange: (e) => {
											setNameDirty(true);
											setTrainName(e.target.value);
										},
										className: "h-11 rounded-md border border-muted/40 bg-surface px-3 font-mono text-sm text-fg"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: training || running,
									onClick: onTrain,
									className: "h-11 rounded-md bg-beam px-3 text-left text-lg font-semibold text-bg disabled:opacity-40",
									children: training ? "Training…" : "Train student"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-xs text-muted",
									children: [
										lessons,
										" rows · curriculum covers ",
										curriculumSize(),
										" states on three maps. Teacher is rules, plus runs you mark."
									]
								}),
								report ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GateCard, { report }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-muted/40 px-3 text-sm",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }),
											" Add model",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "file",
												className: "sr-only",
												multiple: true,
												ref: (node) => {
													node?.setAttribute("webkitdirectory", "");
													node?.setAttribute("directory", "");
												},
												onChange: (e) => {
													onAdd(e.target.files);
													e.target.value = "";
												}
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "inline-flex h-11 cursor-pointer items-center rounded-md border border-muted/40 px-3 text-sm",
										children: ["Zip", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "file",
											accept: ".zip",
											className: "sr-only",
											onChange: (e) => {
												onAdd(e.target.files);
												e.target.value = "";
											}
										})]
									})]
								}),
								addMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-xs text-beam text-pretty",
									children: addMsg
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sticky bottom-0 grid grid-cols-2 gap-2 bg-bg py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: onRun,
								disabled: running || !model?.enabled,
								className: "flex h-12 items-center justify-center gap-2 rounded-md bg-beam text-lg font-semibold text-bg disabled:opacity-40",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }), " Run"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => goHome(),
								className: "flex h-12 items-center justify-center gap-2 rounded-md border border-muted/40 text-lg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(House, { className: "size-4" }), " Home"]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative order-1 h-[52dvh] min-h-64 lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1",
					children: [world ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Viewport, {
						world,
						points: mode?.kind === "track" && anchor ? [anchor] : waypoints,
						pilotCam,
						onPick
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
						pilotCam,
						gpsOn,
						pilotName: model?.badge && model.badge.length < 48 ? `${model.name} · ${model.badge}` : model?.name ?? "rules",
						onCam: () => setPilotCam((v) => !v),
						onGps: () => {
							const next = !live.gpsOn;
							live.gpsOn = next;
							setGpsOn(next);
						}
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "h-40 overflow-y-auto border-t border-muted/30 px-4 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-mono text-xs tracking-widest text-muted",
							children: "Run log"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-9 rounded-md border border-muted/40 px-3 text-sm",
							onClick: () => {
								markRun("good");
								persistRows();
							},
							children: "Mark good"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-9 rounded-md border border-muted/40 px-3 text-sm",
							onClick: () => {
								markRun("bad");
								persistRows();
							},
							children: "Mark bad"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs text-muted",
							children: "Stick A left · D right · W climb · S sink"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Log, {})]
			})
		]
	});
}
function Picker({ icon, title, items, selected, onSelect, locked }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "grid gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
			className: "flex items-center gap-2 font-mono text-xs tracking-widest text-muted",
			children: [
				icon,
				" ",
				title
			]
		}), items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			disabled: !item.enabled || locked,
			onClick: () => onSelect(item.id),
			className: rowClass(selected === item.id, item.enabled),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block text-lg leading-tight",
				children: item.label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate font-mono text-xs text-muted",
				children: item.enabled ? item.detail : "not yet"
			})]
		}, item.id))]
	});
}
function rowClass(on, enabled) {
	return [
		"min-h-11 rounded-md border px-3 py-1 text-left",
		on ? "border-beam bg-surface text-fg" : "border-muted/30 bg-bg text-fg",
		enabled ? "" : "opacity-40"
	].join(" ");
}
function Choice({ label, value, options, onChange, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-xs text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-2",
			children: options.map(([id, name]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled,
				onClick: () => onChange(id),
				className: value === id ? "h-11 rounded-md bg-beam px-3 text-sm font-semibold text-bg" : "h-11 rounded-md border border-muted/40 px-3 text-sm",
				children: name
			}, id))
		})]
	});
}
function GateCard({ report }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-muted/30 bg-surface p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "font-mono text-xs text-fg",
			children: [
				"loss ",
				report.loss.toFixed(3),
				" · ",
				report.passed ? `saved ${report.savedPath}` : "failed · rules stays selected"
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 grid gap-1",
			children: report.gates.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "font-mono text-xs text-muted",
				children: [
					g.pass ? "pass" : "miss",
					" ",
					g.name,
					": ",
					g.got,
					" · want ",
					g.expect
				]
			}, g.name))
		})]
	});
}
function Hud({ pilotCam, gpsOn, pilotName, onCam, onGps }) {
	(0, import_react.useSyncExternalStore)(subscribe, getVersion, getVersion);
	const fix = gpsOn && live.gpsOn;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-md bg-bg/80 px-3 py-2 font-mono text-xs text-fg",
				children: fix ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					live.lat.toFixed(5),
					" ",
					live.lon.toFixed(5),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					"E ",
					live.east.toFixed(1),
					" m · N ",
					live.north.toFixed(1),
					" m"
				] }) : "no fix"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onGps,
					className: "h-11 rounded-md bg-bg/80 px-3 font-mono text-xs text-fg",
					children: fix ? "GPS fix" : "GPS lost"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-pressed": pilotCam,
					onClick: onCam,
					className: "flex h-11 items-center gap-2 rounded-md bg-bg/80 px-3 font-mono text-xs text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-4" }), " pilot camera"]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stick, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-bg/80 px-3 py-2 font-mono text-xs text-fg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "battery"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
						className: "text-right tabular-nums",
						children: [live.battery.toFixed(0), "%"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "altitude"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
						className: "text-right tabular-nums",
						children: [live.alt.toFixed(1), " m"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "distance"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
						className: "text-right tabular-nums",
						children: [live.dist.toFixed(1), " m"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "obstacle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
						className: "text-right",
						children: [
							live.nearest,
							" ",
							live.nearest === "none" ? "" : `${live.nearestM.toFixed(0)}m`
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "pilot"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "text-right",
						children: live.status === "idle" ? pilotName : live.pilotLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "phase"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
						className: "text-right text-beam",
						children: [
							live.status === "idle" ? "ready" : live.command,
							live.note ? ` · ${live.note}` : "",
							live.status === "failed" ? ` · ${live.failReason}` : "",
							live.status === "landed" ? " · down" : ""
						]
					})
				]
			})]
		})]
	});
}
function Stick() {
	const press = (code, down) => {
		if (down) keys.add(code);
		else keys.delete(code);
	};
	const btn = (label, code) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "pointer-events-auto h-11 w-11 rounded-md bg-bg/80 font-mono text-sm text-fg",
		onPointerDown: () => press(code, true),
		onPointerUp: () => press(code, false),
		onPointerLeave: () => press(code, false),
		children: label
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-3 gap-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
			btn("W", "KeyW"),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
			btn("A", "KeyA"),
			btn("S", "KeyS"),
			btn("D", "KeyD")
		]
	});
}
function Log() {
	(0, import_react.useSyncExternalStore)(subscribe, getVersion, getVersion);
	if (live.log.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "font-mono text-xs text-muted",
		children: "Model answer sits next to the rules answer once you run."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
		className: "grid gap-1",
		children: live.log.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "font-mono text-xs text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted tabular-nums",
					children: [line.t.toFixed(1), "s"]
				}),
				" model ",
				line.model,
				" · threat ",
				line.threat,
				" ",
				"· ",
				line.clearance,
				" · see ",
				line.see,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted",
					children: [" || rules ", line.rules]
				}),
				line.cmd !== line.model ? ` · cmd ${line.cmd}` : "",
				line.note ? ` · ${line.note}` : ""
			]
		}, `${line.t}-${i}`))
	});
}
function typing(e) {
	const tag = e.target?.tagName;
	return tag === "INPUT" || tag === "TEXTAREA";
}
function slug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "typed";
}
function toB64(data) {
	let s = "";
	const chunk = 32768;
	for (let i = 0; i < data.length; i += chunk) s += String.fromCharCode(...data.subarray(i, i + chunk));
	return btoa(s);
}
function persistRows() {
	try {
		localStorage.setItem(ROW_KEY, JSON.stringify(live.rows.slice(-400)));
	} catch {}
}
function rememberFailed(model) {
	let prev = [];
	try {
		prev = JSON.parse(localStorage.getItem(FAIL_KEY) ?? "[]");
	} catch {
		prev = [];
	}
	const next = [...prev.filter((m) => m.id !== model.id), {
		...model,
		modelBase64: void 0
	}];
	localStorage.setItem(FAIL_KEY, JSON.stringify(next));
	return next;
}
function mergeFailed(catalog) {
	let extra = [];
	try {
		extra = JSON.parse(localStorage.getItem(FAIL_KEY) ?? "[]");
	} catch {
		extra = [];
	}
	return {
		...catalog,
		models: mergeModels(catalog.models, extra)
	};
}
function mergeModels(base, extra) {
	const ids = new Set(base.map((m) => m.id));
	return [...base, ...extra.filter((m) => !ids.has(m.id))];
}
function Home() {
	const catalog = Route$1.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimScreen, { initial: catalog });
}
//#endregion
export { Home as component };
