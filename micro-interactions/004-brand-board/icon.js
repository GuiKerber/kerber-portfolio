/* ==========================================================================
   004 · The 3D icon
   The site's logo, built the same way as js/scene.js: the mark extruded in
   dark metal, lit by orange rims, able to break into prisms. Here it draws
   from a state object instead of a clock, so the loop can seek to any frame.
   Every motion that runs on its own repeats exactly once per `period`.
   ========================================================================== */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LOGO_W = 27;
const LOGO_H = 26.7773;
const DEPTH = 4;
const BEVEL = 0.6;
const SPREAD = 0.5; // shards stay near their tile

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Deterministic random so the shard field looks the same on every load
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createIcon(canvas, path, { period, spread = SPREAD, scale = 1.31 }) {
  const color = {
    body: token('--color-scene-body'),
    key: token('--color-scene-key'),
    rim: token('--color-scene-rim'),
    fill: token('--color-scene-fill'),
  };
  const rand = mulberry32(7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // Lights: dark body, hot orange rims, one cool fill
  scene.add(new THREE.AmbientLight(color.key, 0.08));
  const key = new THREE.DirectionalLight(color.key, 0.6);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rimA = new THREE.PointLight(color.rim, 70, 14, 1.6);
  const rimB = new THREE.PointLight(color.rim, 40, 12, 1.6);
  const rimC = new THREE.PointLight(color.fill, 18, 14, 1.8);
  scene.add(rimA, rimB, rimC);

  const svg = new SVGLoader().parse(`<svg viewBox="0 0 ${LOGO_W} ${LOGO_H}"><path fill-rule="evenodd" d="${path}"/></svg>`);
  const shapes = svg.paths.flatMap((p) => SVGLoader.createShapes(p));

  const material = new THREE.MeshPhysicalMaterial({
    color: color.body, metalness: 0.85, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55,
  });
  const shardMaterial = material.clone();
  shardMaterial.envMapIntensity = 0.3;
  shardMaterial.roughness = 0.38;

  const root = new THREE.Group();   // tilt and idle sway
  scene.add(root);
  const logo = new THREE.Group();   // SVG space -> world space
  const unit = 0.15;
  logo.scale.set(unit, -unit, unit);
  logo.position.set((-LOGO_W / 2) * unit, (LOGO_H / 2) * unit, 0);
  root.add(logo);

  const logoGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: 0.45, bevelSegments: 5, curveSegments: 28,
  });
  logoGeo.translate(0, 0, -DEPTH / 2);
  const logoMesh = new THREE.Mesh(logoGeo, material);
  logo.add(logoMesh);

  /* Shards: the logo face, triangulated and split into prisms */
  const shardGroup = new THREE.Group();
  shardGroup.visible = false;
  logo.add(shardGroup);
  const shards = [];
  const center = new THREE.Vector2(LOGO_W / 2, LOGO_H / 2);

  function splitTriangle(a, b, c, out, maxArea) {
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    if (area <= maxArea) { if (area > 0.02) out.push([a, b, c]); return; }
    const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a);
    const t = 0.35 + rand() * 0.3;
    if (ab >= bc && ab >= ca) {
      const m = a.clone().lerp(b, t);
      splitTriangle(a, m, c, out, maxArea); splitTriangle(m, b, c, out, maxArea);
    } else if (bc >= ca) {
      const m = b.clone().lerp(c, t);
      splitTriangle(a, b, m, out, maxArea); splitTriangle(a, m, c, out, maxArea);
    } else {
      const m = c.clone().lerp(a, t);
      splitTriangle(a, b, m, out, maxArea); splitTriangle(m, b, c, out, maxArea);
    }
  }

  const tris = [];
  shapes.forEach((shape) => {
    const { shape: outer, holes } = shape.extractPoints(10);
    const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
    const verts = [...outer, ...holes.flat()];
    faces.forEach(([i, j, k]) => splitTriangle(verts[i], verts[j], verts[k], tris, 7));
  });

  const shardDepth = DEPTH + BEVEL * 2;
  tris.forEach(([a, b, c]) => {
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const s = new THREE.Shape([new THREE.Vector2(a.x - cx, a.y - cy), new THREE.Vector2(b.x - cx, b.y - cy), new THREE.Vector2(c.x - cx, c.y - cy)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: shardDepth, bevelEnabled: false });
    g.translate(0, 0, -shardDepth / 2);
    const mesh = new THREE.Mesh(g, shardMaterial);
    mesh.position.set(cx, cy, 0);
    shardGroup.add(mesh);

    const out = new THREE.Vector2(cx, cy).sub(center);
    const len = out.length() || 1;
    out.divideScalar(len);
    const ang = Math.atan2(out.y, out.x) + (rand() - 0.5) * 1.4;
    const reach = (18 + rand() * 52) * spread;
    shards.push({
      mesh,
      origin: new THREE.Vector3(cx, cy, 0),
      dir: new THREE.Vector3(Math.cos(ang) * reach, Math.sin(ang) * reach * 0.75, (rand() - 0.62) * 48 * spread),
      rot: new THREE.Vector3((rand() - 0.5) * 9, (rand() - 0.5) * 9, (rand() - 0.5) * 6),
      float: rand() * Math.PI * 2,
      delay: rand() * 0.25 + (len / 20) * 0.15,
    });
  });

  // The icon fills about 60% of the tile's shorter side
  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    root.scale.setScalar(scale * Math.min(camera.aspect, 1));
  }

  const euler = new THREE.Euler();

  /* t: seconds into the loop; tiltX / tiltY: -1..1 toward the pointer;
     explode: 0 whole, 1 fully apart */
  function render({ t, tiltX, tiltY, explode, spin = 0 }) {
    const a = (t / period) * Math.PI * 2; // one turn per loop, so it repeats seamlessly

    root.rotation.y = -0.38 + Math.sin(a) * 0.28 + tiltX * 0.35 + spin; // spin: optional extra turn, in radians
    root.rotation.x = 0.12 + Math.sin(a + 1.3) * 0.06 - tiltY * 0.22;
    root.rotation.z = Math.sin(a + 0.6) * 0.03;

    rimA.position.set(Math.cos(a) * 4.5, -3 + Math.sin(a) * 1.2, -1.5);
    rimB.position.set(Math.cos(a + 2.4) * 4, 3.2, Math.sin(a) * 2 - 1);
    rimC.position.set(4, Math.sin(a + 0.8) * 3, 3);

    const shattered = explode > 0.001;
    logoMesh.visible = !shattered;
    shardGroup.visible = shattered;
    if (shattered) {
      shards.forEach((s) => {
        const local = easeOutCubic(clamp((explode - s.delay * 0.5) / (1 - s.delay * 0.5)));
        s.mesh.position.set(
          s.origin.x + s.dir.x * local + Math.sin(a + s.float) * 1.2 * local,
          s.origin.y + s.dir.y * local + Math.cos(a + s.float) * 1.2 * local,
          s.origin.z + s.dir.z * local + Math.sin(a + s.float * 2) * 1.5 * local,
        );
        euler.set(s.rot.x * local, s.rot.y * local, s.rot.z * local);
        s.mesh.rotation.copy(euler);
      });
    }
    renderer.render(scene, camera);
  }

  resize();
  return { render, resize };
}
