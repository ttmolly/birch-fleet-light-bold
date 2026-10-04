import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Brain, Camera, Cpu, House, Map as MapIcon, Plane, Play, Plus, Route } from "lucide-react";
import { addModelFolder, getCatalog } from "@/lib/moka/catalog.functions";
import { hydrateModel, pilotFor } from "@/lib/moka/pilot";
import { curriculumSize, rowCount, trainStudentBundle, type TrainReport } from "@/lib/moka/train";
import type { Catalog, ModelManifest } from "@/lib/moka/types";
import {
  arm,
  getVersion,
  goHome,
  installProbe,
  keys,
  live,
  markRun,
  placeOnPad,
  sampleGoals,
  subscribe,
} from "@/lib/sim/flight";
import { buildWorld, type Vec3 } from "@/lib/sim/world";
import { Viewport } from "./Viewport";
import { unzipSync } from "fflate";

const FAIL_KEY = "moka-beam-failed";
const ROW_KEY = "moka-beam-rows";

const ORDER: Record<string, string[]> = {
  hardware: ["pi5-8gb", "pi4-4gb", "jetson"],
  drones: ["fpv-quad", "wing", "rover"],
  maps: ["corvid", "heron", "falcon"],
  modes: ["track", "a-to-b", "a-to-b-opposed", "thread"],
  models: ["rules", "moka-flight", "typed"],
};

function sortBy<T extends { id: string }>(list: T[], key: string) {
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

export function SimScreen({ initial }: { initial: Catalog }) {
  const [catalog, setCatalog] = useState(initial);
  const [hardwareId, setHardwareId] = useState("pi5-8gb");
  const [droneId, setDroneId] = useState("fpv-quad");
  const [mapId, setMapId] = useState("corvid");
  const [modeId, setModeId] = useState("a-to-b");
  const [pilotId, setPilotId] = useState("rules");
  const [targetKind, setTargetKind] = useState<"marker" | "drone">("marker");
  const [pattern, setPattern] = useState<"shuttle" | "patrol" | "break">("shuttle");
  const [waypoints, setWaypoints] = useState<Vec3[]>([]);
  const [anchor, setAnchor] = useState<Vec3 | null>(null);
  const [pilotCam, setPilotCam] = useState(false);
  const [gpsOn, setGpsOn] = useState(true);
  const [trainName, setTrainName] = useState("moka-beam-corvid-1");
  const [nameDirty, setNameDirty] = useState(false);
  const [training, setTraining] = useState(false);
  const [report, setReport] = useState<TrainReport | null>(null);
  const [addMsg, setAddMsg] = useState("");
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const hardware = sortBy(catalog.hardware, "hardware");
  const drones = sortBy(catalog.drones, "drones");
  const maps = sortBy(catalog.maps, "maps");
  const modes = sortBy(catalog.modes, "modes");
  const models = sortBy(catalog.models, "models");
  const map = maps.find((m) => m.id === mapId) ?? maps[0];
  const mode = modes.find((m) => m.id === modeId) ?? modes[0];
  const model = models.find((m) => m.id === pilotId) ?? models.find((m) => m.id === "rules");
  const world = useMemo(() => (map ? buildWorld(map) : null), [map]);
  const gpsRef = useRef(gpsOn);
  gpsRef.current = gpsOn;
  const running = live.status === "running";
  void version;

  useEffect(() => {
    installProbe();
    setCatalog(mergeFailed(initial));
    try {
      const raw = localStorage.getItem(ROW_KEY);
      if (raw) {
        const rows = JSON.parse(raw) as typeof live.rows;
        if (Array.isArray(rows)) live.rows = rows.slice(-800);
      }
    } catch {
      /* ignore */
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
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

  useEffect(() => {
    if (!world || live.status === "running") return;
    placeOnPad(world);
    live.gpsOn = gpsRef.current;
  }, [world]);

  useEffect(() => {
    if (nameDirty) return;
    const n = models.filter((m) => m.id.startsWith(`moka-beam-${mapId}`)).length + 1;
    setTrainName(`moka-beam-${mapId}-${n}`);
  }, [mapId, models, nameDirty]);

  function onPick(point: Vec3) {
    if (live.status === "running") return;
    if (mode?.kind === "track") setAnchor(point);
    else setWaypoints((w) => [...w, point].slice(0, 8));
  }

  async function onRun() {
    if (!world || !mode || !model || running) return;
    if (!model.enabled || model.failed) return;
    const ready = await hydrateModel(model);
    const ask = pilotFor(ready);
    const goals = sampleGoals(world, mode.kind, waypoints, anchor);
    arm({
      mapId: world.id,
      modeKind: mode.kind,
      world,
      goals,
      trackTarget: targetKind,
      pattern,
      anchor,
      ask,
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
        taken: models.map((m) => m.id),
      });
      setReport(result);
      if (result.passed && result.model) {
        setCatalog((c) => ({ ...c, models: [...c.models.filter((m) => m.id !== result.id), result.model!] }));
      } else if (result.model) {
        const failed = result.model;
        const next = rememberFailed(failed);
        setCatalog((c) => ({ ...c, models: mergeModels(c.models, next) }));
        setPilotId("rules");
      }
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Train failed");
    } finally {
      setTraining(false);
    }
  }

  async function onAdd(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAddMsg("Reading bundle…");
    try {
      const bag = new Map<string, Uint8Array>();
      const first = files[0];
      if (files.length === 1 && first && first.name.toLowerCase().endsWith(".zip")) {
        const unpacked = unzipSync(new Uint8Array(await first.arrayBuffer()));
        for (const [name, data] of Object.entries(unpacked)) {
          bag.set(name.split("/").pop() ?? name, data);
        }
      } else {
        for (const file of files) {
          const rel = file.webkitRelativePath || file.name;
          bag.set(rel.split("/").pop() ?? file.name, new Uint8Array(await file.arrayBuffer()));
        }
      }
      const configBytes = bag.get("moka_config.json");
      const onnx = bag.get("model.onnx");
      const tokenizerName = [...bag.keys()].find((n) => /tokenizer|vocab/i.test(n));
      if (!configBytes || !onnx || !tokenizerName) {
        setAddMsg("Need model.onnx, a tokenizer, and moka_config.json.");
        return;
      }
      const config = JSON.parse(new TextDecoder().decode(configBytes)) as { id?: string; kind?: string; name?: string };
      const id = slug(config.id || config.name || "typed");
      const huge = onnx.byteLength > 1_500_000;
      const payload: { name: string; base64: string }[] = [];
      for (const [name, data] of bag) {
        if (huge && name === "model.onnx") continue;
        if (data.byteLength > 1_500_000) continue;
        payload.push({ name, base64: toB64(data) });
      }
      await addModelFolder({ data: { id, files: payload } });
      const fresh = mergeFailed(await getCatalog());
      setCatalog(fresh);
      setAddMsg(
        huge || config.kind === "laya"
          ? "Bundle noted. Not a flight pilot. Laya weights are not loaded."
          : `Added models/${id}`,
      );
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Could not add that bundle");
    }
  }

  const lessons = rowCount(live.rows);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-muted/30 px-4 py-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-beam">LOCAL MISSION SIM</p>
          <h1 className="text-3xl leading-none font-semibold tracking-wide text-balance">Moka-beam</h1>
        </div>
        <p className="max-w-md font-mono text-xs text-muted text-pretty">
          You pick the board, the craft, the map, the mode, and the pilot. The pilot only names the next phase.
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 flex max-h-[70dvh] flex-col gap-4 overflow-y-auto border-muted/30 px-4 py-3 lg:order-1 lg:max-h-none lg:w-80 lg:shrink-0 lg:border-r">
          <Picker
            icon={<Cpu className="size-4" />}
            title="Hardware"
            locked={running}
            items={hardware.map((h) => ({
              id: h.id,
              label: h.name,
              detail: `${h.ram_gb} GB`,
              enabled: h.enabled,
            }))}
            selected={hardwareId}
            onSelect={setHardwareId}
          />
          <Picker
            icon={<Plane className="size-4" />}
            title="Drone"
            locked={running}
            items={drones.map((d) => ({
              id: d.id,
              label: d.name,
              detail: d.camera,
              enabled: d.enabled,
            }))}
            selected={droneId}
            onSelect={setDroneId}
          />
          <Picker
            icon={<MapIcon className="size-4" />}
            title="Map"
            locked={running}
            items={maps.map((m) => ({
              id: m.id,
              label: m.bird,
              detail: `${m.biome} · ${m.home_pad.label ?? "pad"}`,
              enabled: m.enabled,
            }))}
            selected={mapId}
            onSelect={(id) => {
              setMapId(id);
              setWaypoints([]);
              setAnchor(null);
            }}
          />
          <Picker
            icon={<Route className="size-4" />}
            title="Mode"
            locked={running}
            items={modes.map((m) => ({
              id: m.id,
              label: m.name,
              detail: m.summary,
              enabled: m.enabled,
            }))}
            selected={modeId}
            onSelect={setModeId}
          />
          {mode?.kind === "track" ? (
            <div className="grid gap-2">
              <Choice
                label="Target"
                value={targetKind}
                options={[
                  ["marker", "Ground marker"],
                  ["drone", "Second drone"],
                ]}
                disabled={running}
                onChange={(v) => setTargetKind(v as "marker" | "drone")}
              />
              <Choice
                label="Pattern"
                value={pattern}
                options={[
                  ["shuttle", "Shuttle"],
                  ["patrol", "Patrol"],
                  ["break", "Break"],
                ]}
                disabled={running}
                onChange={(v) => setPattern(v as "shuttle" | "patrol" | "break")}
              />
              <p className="font-mono text-xs text-muted">
                {anchor ? "Pattern placed. Click the map to move it." : "Click the map to place the pattern."} Lose
                the target and it holds, searches, then returns.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="font-mono text-xs text-muted text-pretty">
                {mode?.kind === "thread"
                  ? "Meant for Heron. Click a thread, or run the sample gaps. A trunk ends the run."
                  : mode?.kind === "opposed"
                    ? "Click waypoints. Other drones and hazards only block space. No weapons."
                    : "Click waypoints. The craft flies them in order and lands on the last. Empty uses a sample leg."}
              </p>
              <div className="flex flex-wrap gap-2">
                {waypoints.map((p, i) => (
                  <span key={`${p.x}-${p.z}-${i}`} className="font-mono text-xs text-fg">
                    {i + 1} {p.x.toFixed(0)},{p.z.toFixed(0)}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="h-11 rounded-md border border-muted/40 px-3 text-left text-sm text-muted"
                disabled={running || waypoints.length === 0}
                onClick={() => setWaypoints([])}
              >
                Clear points
              </button>
            </div>
          )}
          <section className="grid gap-2">
            <h2 className="flex items-center gap-2 font-mono text-xs tracking-widest text-muted">
              <Brain className="size-4" /> Pilot
            </h2>
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!m.enabled || running}
                onClick={() => setPilotId(m.id)}
                className={rowClass(pilotId === m.id, m.enabled)}
              >
                <span className="block text-lg leading-tight">{m.name}</span>
                <span className="block font-mono text-xs text-muted">
                  {m.kind}
                  {m.badge ? ` · ${m.badge}` : ""}
                  {m.failed ? " · failed" : ""}
                </span>
              </button>
            ))}
            <label className="grid gap-1 font-mono text-xs text-muted">
              Student name
              <input
                value={trainName}
                disabled={training || running}
                onChange={(e) => {
                  setNameDirty(true);
                  setTrainName(e.target.value);
                }}
                className="h-11 rounded-md border border-muted/40 bg-surface px-3 font-mono text-sm text-fg"
              />
            </label>
            <button
              type="button"
              disabled={training || running}
              onClick={onTrain}
              className="h-11 rounded-md bg-beam px-3 text-left text-lg font-semibold text-bg disabled:opacity-40"
            >
              {training ? "Training…" : "Train student"}
            </button>
            <p className="font-mono text-xs text-muted">
              {lessons} rows · curriculum covers {curriculumSize()} states on three maps. Teacher is rules, plus runs
              you mark.
            </p>
            {report ? <GateCard report={report} /> : null}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-muted/40 px-3 text-sm">
                <Plus className="size-4" /> Add model
                <input
                  type="file"
                  className="sr-only"
                  multiple
                  ref={(node) => {
                    node?.setAttribute("webkitdirectory", "");
                    node?.setAttribute("directory", "");
                  }}
                  onChange={(e) => {
                    void onAdd(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-muted/40 px-3 text-sm">
                Zip
                <input
                  type="file"
                  accept=".zip"
                  className="sr-only"
                  onChange={(e) => {
                    void onAdd(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {addMsg ? <p className="font-mono text-xs text-beam text-pretty">{addMsg}</p> : null}
          </section>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-bg py-2">
            <button
              type="button"
              onClick={onRun}
              disabled={running || !model?.enabled}
              className="flex h-12 items-center justify-center gap-2 rounded-md bg-beam text-lg font-semibold text-bg disabled:opacity-40"
            >
              <Play className="size-4" /> Run
            </button>
            <button
              type="button"
              onClick={() => goHome()}
              className="flex h-12 items-center justify-center gap-2 rounded-md border border-muted/40 text-lg"
            >
              <House className="size-4" /> Home
            </button>
          </div>
        </aside>
        <div className="relative order-1 h-[52dvh] min-h-64 lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
          {world ? (
            <Viewport world={world} points={mode?.kind === "track" && anchor ? [anchor] : waypoints} pilotCam={pilotCam} onPick={onPick} />
          ) : null}
          <Hud
            pilotCam={pilotCam}
            gpsOn={gpsOn}
            pilotName={
              model?.badge && model.badge.length < 48 ? `${model.name} · ${model.badge}` : (model?.name ?? "rules")
            }
            onCam={() => setPilotCam((v) => !v)}
            onGps={() => {
              const next = !live.gpsOn;
              live.gpsOn = next;
              setGpsOn(next);
            }}
          />
        </div>
      </div>
      <section className="h-40 overflow-y-auto border-t border-muted/30 px-4 py-2">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-xs tracking-widest text-muted">Run log</h2>
          <button type="button" className="h-9 rounded-md border border-muted/40 px-3 text-sm" onClick={() => { markRun("good"); persistRows(); }}>
            Mark good
          </button>
          <button type="button" className="h-9 rounded-md border border-muted/40 px-3 text-sm" onClick={() => { markRun("bad"); persistRows(); }}>
            Mark bad
          </button>
          <span className="font-mono text-xs text-muted">Stick A left · D right · W climb · S sink</span>
        </div>
        <Log />
      </section>
    </div>
  );
}

function Picker({
  icon,
  title,
  items,
  selected,
  onSelect,
  locked,
}: {
  icon: ReactNode;
  title: string;
  items: { id: string; label: string; detail: string; enabled: boolean }[];
  selected: string;
  onSelect: (id: string) => void;
  locked: boolean;
}) {
  return (
    <section className="grid gap-1">
      <h2 className="flex items-center gap-2 font-mono text-xs tracking-widest text-muted">
        {icon} {title}
      </h2>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={!item.enabled || locked}
          onClick={() => onSelect(item.id)}
          className={rowClass(selected === item.id, item.enabled)}
        >
          <span className="block text-lg leading-tight">{item.label}</span>
          <span className="block truncate font-mono text-xs text-muted">{item.enabled ? item.detail : "not yet"}</span>
        </button>
      ))}
    </section>
  );
}

function rowClass(on: boolean, enabled: boolean) {
  return [
    "min-h-11 rounded-md border px-3 py-1 text-left",
    on ? "border-beam bg-surface text-fg" : "border-muted/30 bg-bg text-fg",
    enabled ? "" : "opacity-40",
  ].join(" ");
}

function Choice({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-xs text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([id, name]) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className={
              value === id
                ? "h-11 rounded-md bg-beam px-3 text-sm font-semibold text-bg"
                : "h-11 rounded-md border border-muted/40 px-3 text-sm"
            }
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function GateCard({ report }: { report: TrainReport }) {
  return (
    <div className="rounded-md border border-muted/30 bg-surface p-3">
      <p className="font-mono text-xs text-fg">
        loss {report.loss.toFixed(3)} · {report.passed ? `saved ${report.savedPath}` : "failed · rules stays selected"}
      </p>
      <ul className="mt-2 grid gap-1">
        {report.gates.map((g) => (
          <li key={g.name} className="font-mono text-xs text-muted">
            {g.pass ? "pass" : "miss"} {g.name}: {g.got} · want {g.expect}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hud({
  pilotCam,
  gpsOn,
  pilotName,
  onCam,
  onGps,
}: {
  pilotCam: boolean;
  gpsOn: boolean;
  pilotName: string;
  onCam: () => void;
  onGps: () => void;
}) {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  void version;
  const fix = gpsOn && live.gpsOn;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-md bg-bg/80 px-3 py-2 font-mono text-xs text-fg">
          {fix ? (
            <>
              {live.lat.toFixed(5)} {live.lon.toFixed(5)}
              <br />E {live.east.toFixed(1)} m · N {live.north.toFixed(1)} m
            </>
          ) : (
            "no fix"
          )}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button type="button" onClick={onGps} className="h-11 rounded-md bg-bg/80 px-3 font-mono text-xs text-fg">
            {fix ? "GPS fix" : "GPS lost"}
          </button>
          <button
            type="button"
            aria-pressed={pilotCam}
            onClick={onCam}
            className="flex h-11 items-center gap-2 rounded-md bg-bg/80 px-3 font-mono text-xs text-fg"
          >
            <Camera className="size-4" /> pilot camera
          </button>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <Stick />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-bg/80 px-3 py-2 font-mono text-xs text-fg">
          <dt className="text-muted">battery</dt>
          <dd className="text-right tabular-nums">{live.battery.toFixed(0)}%</dd>
          <dt className="text-muted">altitude</dt>
          <dd className="text-right tabular-nums">{live.alt.toFixed(1)} m</dd>
          <dt className="text-muted">distance</dt>
          <dd className="text-right tabular-nums">{live.dist.toFixed(1)} m</dd>
          <dt className="text-muted">obstacle</dt>
          <dd className="text-right">
            {live.nearest} {live.nearest === "none" ? "" : `${live.nearestM.toFixed(0)}m`}
          </dd>
          <dt className="text-muted">pilot</dt>
          <dd className="text-right">{live.status === "idle" ? pilotName : live.pilotLabel}</dd>
          <dt className="text-muted">phase</dt>
          <dd className="text-right text-beam">
            {live.status === "idle" ? "ready" : live.command}
            {live.note ? ` · ${live.note}` : ""}
            {live.status === "failed" ? ` · ${live.failReason}` : ""}
            {live.status === "landed" ? " · down" : ""}
          </dd>
        </dl>
      </div>
    </div>
  );
}

function Stick() {
  const press = (code: string, down: boolean) => {
    if (down) keys.add(code);
    else keys.delete(code);
  };
  const btn = (label: string, code: string) => (
    <button
      type="button"
      className="pointer-events-auto h-11 w-11 rounded-md bg-bg/80 font-mono text-sm text-fg"
      onPointerDown={() => press(code, true)}
      onPointerUp={() => press(code, false)}
      onPointerLeave={() => press(code, false)}
    >
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1">
      <span />
      {btn("W", "KeyW")}
      <span />
      {btn("A", "KeyA")}
      {btn("S", "KeyS")}
      {btn("D", "KeyD")}
    </div>
  );
}

function Log() {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  void version;
  if (live.log.length === 0) {
    return <p className="font-mono text-xs text-muted">Model answer sits next to the rules answer once you run.</p>;
  }
  return (
    <ol className="grid gap-1">
      {live.log.map((line, i) => (
        <li key={`${line.t}-${i}`} className="font-mono text-xs text-fg">
          <span className="text-muted tabular-nums">{line.t.toFixed(1)}s</span> model {line.model} · threat {line.threat}{" "}
          · {line.clearance} · see {line.see}
          <span className="text-muted"> || rules {line.rules}</span>
          {line.cmd !== line.model ? ` · cmd ${line.cmd}` : ""}
          {line.note ? ` · ${line.note}` : ""}
        </li>
      ))}
    </ol>
  );
}

function typing(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

function slug(name: string) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || "typed";
}

function toB64(data: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) s += String.fromCharCode(...data.subarray(i, i + chunk));
  return btoa(s);
}

function persistRows() {
  try {
    localStorage.setItem(ROW_KEY, JSON.stringify(live.rows.slice(-400)));
  } catch {
    /* ignore */
  }
}

function rememberFailed(model: ModelManifest) {
  let prev: ModelManifest[] = [];
  try {
    prev = JSON.parse(localStorage.getItem(FAIL_KEY) ?? "[]") as ModelManifest[];
  } catch {
    prev = [];
  }
  const next = [...prev.filter((m) => m.id !== model.id), { ...model, modelBase64: undefined }];
  localStorage.setItem(FAIL_KEY, JSON.stringify(next));
  return next;
}

function mergeFailed(catalog: Catalog): Catalog {
  let extra: ModelManifest[] = [];
  try {
    extra = JSON.parse(localStorage.getItem(FAIL_KEY) ?? "[]") as ModelManifest[];
  } catch {
    extra = [];
  }
  return { ...catalog, models: mergeModels(catalog.models, extra) };
}

function mergeModels(base: ModelManifest[], extra: ModelManifest[]) {
  const ids = new Set(base.map((m) => m.id));
  return [...base, ...extra.filter((m) => !ids.has(m.id))];
}
