//#region node_modules/.nitro/vite/services/ssr/assets/bundled-g1t1dxb0.js
var manifest_default$15 = {
	id: "jetson",
	name: "Jetson",
	ram_gb: 8,
	enabled: false
};
var manifest_default$14 = {
	id: "pi4-4gb",
	name: "Pi 4 4GB",
	ram_gb: 4,
	enabled: false
};
var manifest_default$13 = {
	id: "pi5-8gb",
	name: "Raspberry Pi 5 8GB",
	ram_gb: 8,
	enabled: true
};
var manifest_default$12 = {
	id: "fpv-quad",
	name: "FPV quadcopter",
	kind: "quad",
	camera: "nose-fpv",
	enabled: true
};
var manifest_default$11 = {
	id: "rover",
	name: "rover",
	kind: "rover",
	camera: "mast",
	enabled: false
};
var manifest_default$10 = {
	id: "wing",
	name: "wing",
	kind: "wing",
	camera: "nose",
	enabled: false
};
var manifest_default$9 = {
	id: "corvid",
	bird: "Corvid",
	biome: "city",
	home_pad: {
		"x": 0,
		"y": 12,
		"z": 0,
		"label": "rooftop"
	},
	origin: {
		"lat": 51.2277,
		"lon": 6.7735
	},
	enabled: true
};
var manifest_default$8 = {
	id: "falcon",
	bird: "Falcon",
	biome: "desert",
	home_pad: {
		"x": 0,
		"y": .25,
		"z": 18,
		"label": "flat"
	},
	origin: {
		"lat": 33.448,
		"lon": -112.074
	},
	enabled: true
};
var manifest_default$7 = {
	id: "heron",
	bird: "Heron",
	biome: "woods",
	home_pad: {
		"x": 0,
		"y": .2,
		"z": 0,
		"label": "clearing"
	},
	origin: {
		"lat": 46.532,
		"lon": 11.456
	},
	enabled: true
};
var manifest_default$6 = {
	id: "a-to-b",
	name: "A to B",
	kind: "waypoints",
	summary: "Click waypoints. The craft flies them in order and lands on the last.",
	enabled: true
};
var manifest_default$5 = {
	id: "a-to-b-opposed",
	name: "A to B, opposed",
	kind: "opposed",
	summary: "Same waypoints, plus other drones and hazards that only occupy space.",
	enabled: true
};
var manifest_default$4 = {
	id: "thread",
	name: "Thread",
	kind: "thread",
	summary: "Obstacle avoidance, meant for Heron. Hit a trunk and the run fails.",
	enabled: true
};
var manifest_default$3 = {
	id: "track",
	name: "Track",
	kind: "track",
	summary: "Follow a marker or a second drone. Shuttle, patrol, or break.",
	enabled: true
};
var manifest_default$2 = {
	id: "moka-flight",
	name: "moka-flight",
	kind: "student",
	trained_on: "shipped student, distance weights held at zero",
	enabled: true,
	note: "weak on distance"
};
var manifest_default$1 = {
	id: "rules",
	name: "rules",
	kind: "rules",
	trained_on: "teacher",
	enabled: true,
	note: "No weights. Far and healthy is enroute, close is approach, over the pad is land, low battery or no GPS is rtl."
};
var manifest_default = {
	id: "typed",
	name: "typed",
	kind: "laya",
	trained_on: "none",
	enabled: false,
	note: "Slot for a dropped Laya bundle."
};
var model_default = "/assets/model-DwkGojny.onnx";
var hardware = /* #__PURE__ */ Object.assign({
	"../../../hardware/jetson/manifest.json": manifest_default$15,
	"../../../hardware/pi4/manifest.json": manifest_default$14,
	"../../../hardware/pi5/manifest.json": manifest_default$13
});
var drones = /* #__PURE__ */ Object.assign({
	"../../../drones/fpv-quad/manifest.json": manifest_default$12,
	"../../../drones/rover/manifest.json": manifest_default$11,
	"../../../drones/wing/manifest.json": manifest_default$10
});
var maps = /* #__PURE__ */ Object.assign({
	"../../../maps/corvid/manifest.json": manifest_default$9,
	"../../../maps/falcon/manifest.json": manifest_default$8,
	"../../../maps/heron/manifest.json": manifest_default$7
});
var modes = /* #__PURE__ */ Object.assign({
	"../../../modes/a-to-b/manifest.json": manifest_default$6,
	"../../../modes/a-to-b-opposed/manifest.json": manifest_default$5,
	"../../../modes/thread/manifest.json": manifest_default$4,
	"../../../modes/track/manifest.json": manifest_default$3
});
var models = /* #__PURE__ */ Object.assign({
	"../../../models/moka-flight/manifest.json": manifest_default$2,
	"../../../models/rules/manifest.json": manifest_default$1,
	"../../../models/typed/manifest.json": manifest_default
});
function bundledCatalog() {
	return {
		hardware: Object.values(hardware),
		drones: Object.values(drones),
		maps: Object.values(maps),
		modes: Object.values(modes),
		models: Object.values(models).map((model) => ({
			...model,
			flight: model.kind === "rules" || model.kind === "student",
			badge: model.kind === "laya" ? "no bundle" : model.note && model.note.length < 48 ? model.note : void 0,
			enabled: model.kind === "laya" ? false : model.enabled !== false
		}))
	};
}
function flightWeightUrl(id) {
	return id === "moka-flight" ? model_default : null;
}
//#endregion
export { flightWeightUrl as n, bundledCatalog as t };
