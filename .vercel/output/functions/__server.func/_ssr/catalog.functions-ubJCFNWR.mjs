import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { t as bundledCatalog } from "./bundled-g1t1dxb0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/catalog.functions-ubJCFNWR.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var GROUPS = [
	"hardware",
	"drones",
	"maps",
	"modes",
	"models"
];
function safeId(id) {
	return /^[a-z0-9][a-z0-9-]{0,48}$/.test(id);
}
var getCatalog_createServerFn_handler = createServerRpc({
	id: "d8ff643924c91627fe5c73209ba5118aed13e1a720827eb65122e145f95bd2a8",
	name: "getCatalog",
	filename: "src/lib/moka/catalog.functions.ts"
}, (opts) => getCatalog.__executeServer(opts));
var getCatalog = createServerFn({ method: "GET" }).handler(getCatalog_createServerFn_handler, async () => {
	const fs = await import("node:fs/promises");
	const path = await import("node:path");
	const root = process.cwd();
	const readGroup = async (folder) => {
		const base = path.join(root, folder);
		let names = [];
		try {
			names = await fs.readdir(base);
		} catch {
			return [];
		}
		const items = [];
		for (const name of names) try {
			const dir = path.join(base, name);
			if (!(await fs.stat(dir)).isDirectory()) continue;
			const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
			const manifest = JSON.parse(raw);
			if (folder === "models") items.push(await decorateModel(fs, path, dir, manifest));
			else items.push(manifest);
		} catch {}
		return items;
	};
	const [hardware, drones, maps, modes, models] = await Promise.all(GROUPS.map((g) => readGroup(g)));
	const disk = {
		hardware,
		drones,
		maps,
		modes,
		models
	};
	return mergeCatalog(bundledCatalog(), disk);
});
function mergeCatalog(base, extra) {
	const byId = (a, b) => {
		const map = new Map(a.map((item) => [item.id, item]));
		for (const item of b) map.set(item.id, item);
		return [...map.values()];
	};
	return {
		hardware: byId(base.hardware, extra.hardware),
		drones: byId(base.drones, extra.drones),
		maps: byId(base.maps, extra.maps),
		modes: byId(base.modes, extra.modes),
		models: byId(base.models, extra.models)
	};
}
async function decorateModel(fs, path, dir, manifest) {
	const id = String(manifest.id ?? path.basename(dir));
	const kind = String(manifest.kind ?? "student");
	let configKind = kind;
	let configFound = false;
	try {
		const cfg = JSON.parse(await fs.readFile(path.join(dir, "moka_config.json"), "utf8"));
		configFound = true;
		if (cfg.kind) configKind = cfg.kind;
	} catch {}
	const onnxPath = path.join(dir, "model.onnx");
	let size = 0;
	try {
		size = (await fs.stat(onnxPath)).size;
	} catch {
		size = 0;
	}
	const has = size > 0;
	const tooBig = size > 15e5;
	const laya = configKind === "laya" || kind === "laya" || id === "typed";
	let modelBase64;
	if (has && !tooBig && !laya && kind !== "rules") {
		const buf = await fs.readFile(onnxPath);
		modelBase64 = Buffer.from(buf).toString("base64");
	}
	const enabled = laya ? has || configFound : kind === "rules" ? manifest.enabled !== false : Boolean(manifest.enabled) && has && !tooBig;
	const note = typeof manifest.note === "string" ? manifest.note : void 0;
	const badge = laya ? has || configFound ? "not a flight pilot" : "no bundle" : tooBig ? "not a flight pilot" : note && note.length < 48 ? note : void 0;
	return {
		id,
		name: String(manifest.name ?? id),
		kind: laya ? "laya" : kind,
		trained_on: String(manifest.trained_on ?? ""),
		enabled,
		note,
		flight: kind === "rules" || has && !tooBig && !laya,
		badge,
		loss: typeof manifest.loss === "number" ? manifest.loss : void 0,
		gates: Array.isArray(manifest.gates) ? manifest.gates : void 0,
		modelBase64
	};
}
var saveModelBundle_createServerFn_handler = createServerRpc({
	id: "c928403d00b6be615ce59c734698d579f9a861a790c410816bfc85d705968898",
	name: "saveModelBundle",
	filename: "src/lib/moka/catalog.functions.ts"
}, (opts) => saveModelBundle.__executeServer(opts));
var saveModelBundle = createServerFn({ method: "POST" }).validator((data) => {
	if (!data || !safeId(data.id)) throw new Error("Model id must be a short slug.");
	if (!data.onnxBase64 || data.onnxBase64.length > 2e6) throw new Error("ONNX bundle is missing or too large.");
	return data;
}).handler(saveModelBundle_createServerFn_handler, async ({ data }) => {
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
		gates: data.manifest.gates
	};
	await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
	return {
		ok: true,
		path: `models/${data.id}`
	};
});
var addModelFolder_createServerFn_handler = createServerRpc({
	id: "bd9dd982ce19322d1603e4f26c008aa69f87a2c142c031a24e5ac40998879c71",
	name: "addModelFolder",
	filename: "src/lib/moka/catalog.functions.ts"
}, (opts) => addModelFolder.__executeServer(opts));
var addModelFolder = createServerFn({ method: "POST" }).validator((data) => {
	if (!data || !safeId(data.id)) throw new Error("Model id must be a short slug.");
	if (!Array.isArray(data.files) || data.files.length === 0) throw new Error("Folder is empty.");
	return data;
}).handler(addModelFolder_createServerFn_handler, async ({ data }) => {
	const fs = await import("node:fs/promises");
	const path = await import("node:path");
	const dir = path.join(process.cwd(), "models", data.id);
	await fs.mkdir(dir, { recursive: true });
	for (const file of data.files) {
		const base = path.basename(file.name);
		if (!base || base === "." || base === "..") continue;
		if (file.base64.length > 2e6) continue;
		await fs.writeFile(path.join(dir, base), Buffer.from(file.base64, "base64"));
	}
	return {
		ok: true,
		path: `models/${data.id}`
	};
});
//#endregion
export { addModelFolder_createServerFn_handler, getCatalog_createServerFn_handler, saveModelBundle_createServerFn_handler };
