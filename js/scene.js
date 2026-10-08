import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { token } from './tokens.js';

const LOGO_SVG = `<svg viewBox="0 0 27 26.7773"><path fill-rule="evenodd" d="${document.querySelector('#logo-mark path').getAttribute('d')}"/></svg>`;
const LOGO_W = 27;
const LOGO_H = 26.7773;
const DEPTH = 4;
const BEVEL = 0.6;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Deterministic random so the shard field looks the same on every load
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScene(canvas, { reducedMotion = false } = {}) {
  const color = {
    body: token('--color-scene-body'),
    edge: token('--color-scene-edge'),
    key: token('--color-scene-key'),
    rim: token('--color-scene-rim'),
    fill: token('--color-scene-fill'),
  };
  const rand = mulberry32(7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // ---------- Lights: dark body, hot orange rims ----------
  scene.add(new THREE.AmbientLight(color.key, 0.08));
  const key = new THREE.DirectionalLight(color.key, 0.6);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rimA = new THREE.PointLight(color.rim, 70, 14, 1.6);
  const rimB = new THREE.PointLight(color.rim, 40, 12, 1.6);
  const rimC = new THREE.PointLight(color.fill, 18, 14, 1.8);
  scene.add(rimA, rimB, rimC);

  // ---------- Logo geometry ----------
  const svg = new SVGLoader().parse(LOGO_SVG);
  const shapes = svg.paths.flatMap((p) => SVGLoader.createShapes(p));

  const material = new THREE.MeshPhysicalMaterial({
    color: color.body,
    metalness: 0.85,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.55,
    transparent: true,
    opacity: 1,
  });

  const shardMaterial = material.clone();
  shardMaterial.envMapIntensity = 0.3;
  shardMaterial.roughness = 0.38;

  const root = new THREE.Group();            // receives mouse / idle rotation
  scene.add(root);
  const logo = new THREE.Group();            // SVG space -> world space
  const unit = 0.15;
  logo.scale.set(unit, -unit, unit);
  logo.position.set(-LOGO_W / 2 * unit, LOGO_H / 2 * unit, 0);
  root.add(logo);

  const logoGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 0.45,
    bevelSegments: 5,
    curveSegments: 28,
  });
  logoGeo.translate(0, 0, -DEPTH / 2);
  const logoMesh = new THREE.Mesh(logoGeo, material);
  logo.add(logoMesh);

  const edgeMat = new THREE.LineBasicMaterial({ color: color.edge, transparent: true, opacity: 0 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(logoGeo, 25), edgeMat);
  logo.add(edges);

  // ---------- Shards: the logo face, triangulated and split into prisms ----------
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
    const s = new THREE.Shape([
      new THREE.Vector2(a.x - cx, a.y - cy),
      new THREE.Vector2(b.x - cx, b.y - cy),
      new THREE.Vector2(c.x - cx, c.y - cy),
    ]);
    const g = new THREE.ExtrudeGeometry(s, { depth: shardDepth, bevelEnabled: false });
    g.translate(0, 0, -shardDepth / 2);
    const mesh = new THREE.Mesh(g, shardMaterial);
    mesh.position.set(cx, cy, 0);
    shardGroup.add(mesh);

    const out = new THREE.Vector2(cx, cy).sub(center);
    const len = out.length() || 1;
    out.divideScalar(len);
    const ang = Math.atan2(out.y, out.x) + (rand() - 0.5) * 1.4;
    const spread = 18 + rand() * 52;
    shards.push({
      mesh,
      origin: new THREE.Vector3(cx, cy, 0),
      dir: new THREE.Vector3(Math.cos(ang) * spread, Math.sin(ang) * spread * 0.75, (rand() - 0.62) * 48),
      rot: new THREE.Vector3((rand() - 0.5) * 9, (rand() - 0.5) * 9, (rand() - 0.5) * 6),
      spin: new THREE.Vector3((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.4),
      float: rand() * Math.PI * 2,
      delay: rand() * 0.25 + (len / 20) * 0.15,
    });
  });

  // ---------- State ----------
  const state = {
    scroll: 0,        // 0..1 hero scrolled away -> shatter
    intro: reducedMotion ? 1 : 0,
    mouse: new THREE.Vector2(),
    mouseEase: new THREE.Vector2(),
    opacity: 1,
  };

  // ---------- Sizing ----------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const fit = camera.aspect < 1 ? 0.62 + camera.aspect * 0.25 : 1;
    root.scale.setScalar(fit);
    root.position.y = camera.aspect < 1 ? -0.6 : -0.15;
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  const euler = new THREE.Euler();
  let running = true;

  function render() {
    const t = clock.getElapsedTime();

    state.mouseEase.lerp(state.mouse, 0.05);
    const motion = reducedMotion ? 0 : 1;

    // Intro: spin in from the side, wireframe first, then solid
    const intro = easeInOutCubic(state.intro);
    root.rotation.y = -0.38 + (1 - intro) * -1.6 + Math.sin(t * 0.45) * 0.28 * motion + state.mouseEase.x * 0.35 * motion;
    root.rotation.x = 0.12 + Math.sin(t * 0.3) * 0.06 * motion - state.mouseEase.y * 0.22 * motion;
    root.rotation.z = Math.sin(t * 0.2) * 0.03 * motion;
    edgeMat.opacity = clamp(state.intro * 3) * (1 - clamp((state.intro - 0.45) * 2.5)) * 0.65;
    material.opacity = clamp((state.intro - 0.35) * 2);
    shardMaterial.opacity = material.opacity;

    // Rim lights orbit
    rimA.position.set(Math.cos(t * 0.6) * 4.5, -3 + Math.sin(t * 0.4) * 1.2, -1.5);
    rimB.position.set(Math.cos(t * 0.5 + 2.4) * 4, 3.2, Math.sin(t * 0.5) * 2 - 1);
    rimC.position.set(4, Math.sin(t * 0.35) * 3, 3);

    const explode = reducedMotion ? 0 : state.scroll;
    const shattered = explode > 0.001;
    logoMesh.visible = !shattered;
    edges.visible = !shattered && edgeMat.opacity > 0.01;
    shardGroup.visible = shattered;

    if (shattered) {
      shards.forEach((s) => {
        const local = easeOutCubic(clamp((explode - s.delay * 0.5) / (1 - s.delay * 0.5)));
        const f = local * motion;
        s.mesh.position.set(
          s.origin.x + s.dir.x * local + Math.sin(t * 0.6 + s.float) * 1.6 * f,
          s.origin.y + s.dir.y * local + Math.cos(t * 0.5 + s.float) * 1.6 * f,
          s.origin.z + s.dir.z * local + Math.sin(t * 0.4 + s.float * 2) * 2 * f,
        );
        euler.set(
          s.rot.x * local + t * s.spin.x * f,
          s.rot.y * local + t * s.spin.y * f,
          s.rot.z * local + t * s.spin.z * f,
        );
        s.mesh.rotation.copy(euler);
      });
    }

    renderer.render(scene, camera);
  }

  function loop() {
    if (running) render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  return {
    playIntro() {
      if (reducedMotion) { state.intro = 1; return; }
      window.gsap.to(state, { intro: 1, duration: 2.2, ease: 'power2.inOut' });
    },
    setScroll(p) { state.scroll = p; },
    setMouse(x, y) { state.mouse.set(x, y); },
    setOpacity(o) {
      state.opacity = o;
      canvas.style.opacity = o;
      running = o > 0.01 && !document.hidden;
    },
  };
}
