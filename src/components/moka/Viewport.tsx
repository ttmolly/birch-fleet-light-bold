import { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { live, refreshHud, subscribe, getVersion, tick } from "@/lib/sim/flight";
import type { Vec3, WorldData } from "@/lib/sim/world";

interface Props {
  world: WorldData;
  points: Vec3[];
  pilotCam: boolean;
  onPick: (point: Vec3) => void;
}

export function Viewport({ world, points, pilotCam, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fpvHostRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef(points);
  const pickRef = useRef(onPick);
  const pilotRef = useRef(pilotCam);
  pointsRef.current = points;
  pickRef.current = onPick;
  pilotRef.current = pilotCam;

  useEffect(() => {
    const host = hostRef.current;
    const fpvHost = fpvHostRef.current;
    if (!host || !fpvHost) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(world.sky);
    scene.fog = new THREE.Fog(world.fog, 28, world.biome === "desert" ? 150 : 110);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 240);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "h-full w-full";
    host.appendChild(renderer.domElement);

    const fpvCam = new THREE.PerspectiveCamera(76, 220 / 132, 0.08, 180);
    const fpv = new THREE.WebGLRenderer({ antialias: false });
    fpv.setPixelRatio(1);
    fpv.setSize(220, 132, false);
    fpv.shadowMap.enabled = false;
    fpv.outputColorSpace = THREE.SRGBColorSpace;
    fpv.domElement.className = "h-full w-full";
    fpvHost.appendChild(fpv.domElement);

    scene.add(new THREE.HemisphereLight(0xf2f4ea, 0x3a4034, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4d8, 1.05);
    sun.position.set(-30, 50, 20);
    scene.add(sun);

    const disposables: { dispose: () => void }[] = [];
    const groundTex = groundTexture(world.biome);
    disposables.push(groundTex);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshLambertMaterial({ map: groundTex, color: world.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    if (world.park) {
      const p = world.park;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(p.w, p.d),
        new THREE.MeshLambertMaterial({ color: 0x1e4634 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, 0.03, p.z);
      scene.add(mesh);
    }
    if (world.streamZ != null) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(130, 4.2),
        new THREE.MeshLambertMaterial({ color: 0x3d6e78 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.04, world.streamZ);
      scene.add(water);
    }

    const pick: THREE.Object3D[] = [ground];
    if (world.buildings.length) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshLambertMaterial({ map: windowTexture() });
      disposables.push(geo, mat, mat.map as THREE.Texture);
      const mesh = new THREE.InstancedMesh(geo, mat, world.buildings.length);
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
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
      const trunkGeo = new THREE.CylinderGeometry(1, 1.05, 1, 6);
      const canopyGeo = new THREE.SphereGeometry(1, 7, 5);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3424 });
      const canopyMat = new THREE.MeshLambertMaterial({ color: world.biome === "city" ? 0x2f6a45 : 0x1f5a38 });
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, world.trees.length);
      const caps = new THREE.InstancedMesh(canopyGeo, canopyMat, world.trees.length);
      const dummy = new THREE.Object3D();
      world.trees.forEach((t, i) => {
        dummy.position.set(t.x, t.trunkH / 2, t.z);
        dummy.scale.set(t.r, t.trunkH, t.r);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(t.x, t.trunkH + t.canopy * 0.45, t.z);
        dummy.scale.set(t.canopy, t.canopy * 0.7, t.canopy);
        dummy.updateMatrix();
        caps.setMatrixAt(i, dummy.matrix);
      });
      scene.add(trunks, caps);
      disposables.push(trunkGeo, canopyGeo, trunkMat, canopyMat);
    }

    if (world.rocks.length) {
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const mat = new THREE.MeshLambertMaterial({ color: 0x8d735c });
      const mesh = new THREE.InstancedMesh(geo, mat, world.rocks.length);
      const dummy = new THREE.Object3D();
      world.rocks.forEach((r, i) => {
        dummy.position.set(r.x, r.s * 0.45, r.z);
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
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        new THREE.MeshLambertMaterial({ color: b.tint }),
      );
      mesh.position.set(b.x, b.y, b.z);
      scene.add(mesh);
    }

    if (world.wires.length) {
      const pts: number[] = [];
      for (const w of world.wires) {
        pts.push(w.ax, w.ay, w.az, w.bx, w.by, w.bz);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6e7c88 }));
      scene.add(line);
      disposables.push(geo);
    }

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.08, 16),
      new THREE.MeshBasicMaterial({ color: 0xd6f25a }),
    );
    pad.position.set(world.home.x, world.home.y + 0.05, world.home.z);
    scene.add(pad);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.06, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0xd6f25a }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pad.position);
    scene.add(ring);

    const craft = makeDrone(0x232823, 0xd6f25a);
    const other = makeDrone(0x6a3d22, 0xe6a15c);
    other.group.visible = false;
    scene.add(craft.group, other.group);

    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.12, 14),
      new THREE.MeshBasicMaterial({ color: 0xe6a15c }),
    );
    marker.visible = false;
    scene.add(marker);

    const actorMat = new THREE.MeshLambertMaterial({ color: 0x8a4a32 });
    const actorGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    const actorMeshes = [0, 1, 2, 3].map(() => {
      const m = new THREE.Mesh(actorGeo, actorMat);
      m.visible = false;
      scene.add(m);
      return m;
    });

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 5);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0xd6f25a });
    const poles = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(poleGeo, poleMat);
      m.visible = false;
      scene.add(m);
      return m;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pick, false);
      const hit = hits[0];
      if (!hit) return;
      pickRef.current({ x: hit.point.x, y: Math.max(0.3, hit.point.y), z: hit.point.z });
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);

    const desired = new THREE.Vector3();
    const look = new THREE.Vector3();
    let last = performance.now();
    let acc = 0;
    let frame = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
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
          marker.position.set(live.target.x, 0.2, live.target.z);
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
        pole.position.set(p.x, p.y + 0.7, p.z);
        pole.scale.set(1, 1.4, 1);
      });

      desired.set(c.x - fx * 8.2, c.y + 3.1, c.z - fz * 8.2);
      camera.position.lerp(desired, 1 - Math.exp(-4 * dt));
      look.set(c.x, c.y + 0.4, c.z);
      camera.lookAt(look);
      renderer.render(scene, camera);

      frame += 1;
      if (pilotRef.current && frame % 2 === 0) {
        fpvCam.position.set(c.x + fx * 0.42, c.y + 0.06, c.z + fz * 0.42);
        fpvCam.lookAt(c.x + fx * 14, c.y - 0.35, c.z + fz * 14);
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
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      disposables.forEach((d) => d.dispose());
    };
  }, [world]);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0 touch-none" />
      <div className={pilotCam ? "absolute right-3 bottom-3 z-10 h-36 w-56" : "hidden"}>
        <div ref={fpvHostRef} className="h-full w-full overflow-hidden rounded-md border border-beam bg-bg" />
        {pilotCam ? <PhaseTag /> : null}
      </div>
    </div>
  );
}

function PhaseTag() {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  void version;
  return (
    <span className="pointer-events-none absolute top-1 left-2 font-mono text-xs text-beam">
      phase {live.command}
      {live.note ? ` · ${live.note}` : ""}
    </span>
  );
}

function groundTexture(biome: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
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
      g.fillRect((i * 47) % 256, (i * 29) % 256, 18, 10);
    }
  } else {
    g.fillStyle = "#c9a36e";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 2 ? "#d8b483" : "#b89260";
      g.fillRect((i * 53) % 256, (i * 31) % 256, 14, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function windowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = "#243140";
  g.fillRect(0, 0, 64, 64);
  for (let y = 6; y < 60; y += 14) {
    for (let x = 5; x < 60; x += 12) {
      g.fillStyle = (x + y) % 24 === 0 ? "#e6b15a" : "#15202b";
      g.fillRect(x, y, 7, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function makeDrone(body: number, nose: number) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: body }));
  group.add(hull);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.06), new THREE.MeshLambertMaterial({ color: 0x1a1a1a })));
  const armB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.7), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  group.add(armB);
  const rotors: THREE.Mesh[] = [];
  const geo = new THREE.CircleGeometry(0.16, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xb7c2ae, side: THREE.DoubleSide });
  for (const [x, z] of [
    [0.3, 0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [-0.3, -0.3],
  ] as const) {
    const r = new THREE.Mesh(geo, mat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.07, z);
    group.add(r);
    rotors.push(r);
  }
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), new THREE.MeshBasicMaterial({ color: nose }));
  cam.position.set(0, 0.02, 0.28);
  group.add(cam);
  return { group, rotors };
}
