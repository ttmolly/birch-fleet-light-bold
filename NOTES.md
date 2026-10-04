# Moka-beam notes

One screen. No account. The pilot never writes motor outputs. It answers with a phase (`enroute`, `approach`, `land`, `rtl`, `hold`), a threat (`yes` or `no`), a clearance (`low`, `ok`, `tight`), and whether it sees the target (`yes` or `no`).

Low confidence forces `hold`. Leaving the geofence, or battery under 20, forces `rtl` no matter what the model says. The craft then lands once it is over the pad.

First load selects `rules`. If an ONNX bundle fails to load, the HUD says `rules, not moka`. A Laya bundle is labeled `not a flight pilot` and is not used to fly. Do not download or fine-tune the 421M Laya weights here.

## Where to drop a new one

A new entry is a folder plus `manifest.json`. Greyed entries stay in the list when `enabled` is false. Restart the app after adding a folder so the list rescans.

| Kind | Folder | Manifest fields |
| --- | --- | --- |
| Board | `hardware/<id>/manifest.json` | `id`, `name`, `ram_gb`, `enabled` |
| Drone | `drones/<id>/manifest.json` | `id`, `name`, `kind`, `camera`, `enabled` |
| Map | `maps/<id>/manifest.json` | `id`, `bird`, `biome`, `home_pad`, `origin`, `enabled` |
| Mode | `modes/<id>/manifest.json` | `id`, `name`, `kind`, `summary`, `enabled` |
| Model | `models/<id>/manifest.json` | `id`, `name`, `kind`, `trained_on`, `enabled` |

`home_pad` is `{ "x", "y", "z", "label" }` in meters. `origin` is `{ "lat", "lon" }`. The corner readout turns craft meters into that GPS frame: +x east, +z north.

`biome` picks the scene: `city`, `woods`, or `desert`. Any other biome shows a flat pad and still flies. A brand-new layout is a branch in `src/lib/sim/world.ts`.

`kind` on a mode is `track`, `waypoints`, `opposed`, or `thread`.

`kind` on a model is `rules`, `student`, or `laya`.

## Model bundle

```
models/<id>/manifest.json
models/<id>/model.onnx
models/<id>/tokenizer.json
models/<id>/moka_config.json
```

`moka_config.json` repeats `id`, `name`, `kind`, and `trained_on`. The shipped student is `moka-tiny`: whitespace state text, 16 features, four linear layers (`16→32→32→32→12`), ONNX ops MatMul, Add, Relu. The Add model button copies a folder or zip with those files into `models/<id>/`.

`models/typed/` is the Laya slot. It stays grey until a bundle is present, then it is marked `not a flight pilot`.

## State text

One plain row per decision, not JSON:

`map corvid distance 46 altitude 12 battery 71 gps yes obstacle none gap 30 target visible`

Add `over pad` when the craft is over the landing point.

Rules, the teacher:

- battery under 20, or `gps no` → `rtl`
- `over pad` → `land`
- distance 8 or less → `approach`
- otherwise, healthy and far → `enroute`

Threat is yes when the named obstacle is inside 10 m. Clearance is `tight` under 5 m, `ok` under 12 m, otherwise `low`.

## Train student

Train student does not fine-tune Laya. It fits a new 4-layer student on the rules labels, plus any run you mark good (those rows are repeated) or bad (kept once). The set covers Corvid, Heron, and Falcon, including far, close, over the pad, battery under 20, GPS lost, a trunk ahead, and a hidden target. Training waits until there are a few hundred rows.

The name defaults to `moka-beam-<map>-<n>`. You can rename it before training.

It becomes selectable only if all five gates pass, in order: far is `enroute`, distance 4 is `approach`, over the pad is `land`, battery 15 is `rtl`, GPS lost is `rtl`. A miss stays in the list as failed and does not write a folder. Rules stays selected. The pilot screen shows the loss and the five results. A pass writes `models/<name>/` and does not swap the live pilot.
