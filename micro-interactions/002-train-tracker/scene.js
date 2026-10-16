/* ==========================================================================
   002 · Train scene
   A soft bullet train in a world of white clay, seen from the side, facing
   right. The train never moves: the slab, the poles, the trees and the hills
   slide past it, and its wheels turn at the same speed, so it reads as a train
   on the move.
   Everything is drawn from `world`, so any moment can be rendered on demand.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const color = (name) => new THREE.Color(token(name));

/* ---------- Sizes, in scene units ---------- */
const SLAB_H = 0.3;
const WHEEL_R = 0.13;
const BODY_H = 0.92;
const BODY_W = 0.96;
const BEVEL = 0.14;
const RAIL_Z = 0.28;

/* Repeating layers. Each one is `span` units long and wraps around: what
   leaves on the left comes back on the right, off screen. The span is wider
   than the view at that depth, so the wrap is never seen. */
const LAYERS = {
  teeth: { gap: 0.16, span: 24 },
  joints: { gap: 1.6, span: 24 },
  poles: { gap: 2.4, span: 24 },
  bushes: { span: 12 },
  trees: { span: 24 },
  hills: { span: 48 },
};

// Small seeded random, so the trees and hills land in the same places every time
function random(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const wrap = (x, span) => ((x % span) + span) % span - span / 2;

/* A low-poly pine: a cone cut into rings, each corner nudged
   a little, so its flat facets catch the light unevenly. Sits on y = 0. */
function pine(radius, height, seed) {
  const rand = random(seed);
  const g = new THREE.ConeGeometry(radius, height, 7, 3);
  const pos = g.attributes.position;
  const nudges = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.hypot(x, z) < 1e-6) continue; // the tip and the base's centre stay put
    // Corners repeated along the seam and the base share one nudge, so no cracks open
    const key = [x, y, z].map((v) => Math.round(v * 1e4)).join();
    if (!nudges.has(key)) {
      const base = y < -height / 2 + 1e-4;
      nudges.set(key, { r: 1 + (rand() - 0.5) * 0.3, y: base ? 0 : (rand() - 0.5) * height * 0.08 });
    }
    const n = nudges.get(key);
    pos.setXYZ(i, x * n.r, y + n.y, z * n.r);
  }
  g.translate(0, height / 2, 0);
  return g;
}

/* ---------- The train ---------- */
const ROOF_STEP = 0.05;   // the roof is cut into short steps so glass can follow it
const VISOR_ROOF = 0.3;   // how far the windscreen carries on over the roof
const VISOR_DEPTH = 0.4;  // its widest point, measured in from the nose's edge

// Side profile of one car; the nose points right when dir is 1, left when -1
function carShape(length, noseLength, dir) {
  const X = (x) => (dir === 1 ? x : length - x);
  const s = new THREE.Shape();
  s.moveTo(X(0), 0);
  s.lineTo(X(length - 0.3), 0);
  s.quadraticCurveTo(X(length), 0, X(length), 0.24);
  s.bezierCurveTo(X(length), 0.46, X(length - noseLength * 0.42), BODY_H, X(length - noseLength), BODY_H);
  for (let x = length - noseLength - ROOF_STEP; x > 0; x -= ROOF_STEP) s.lineTo(X(x), BODY_H);
  s.lineTo(X(0), BODY_H);
  s.lineTo(X(0), 0);
  return s;
}

// The nose curve on its own, used to lay the windscreen along it
function noseCurve(length, noseLength, dir) {
  const X = (x) => (dir === 1 ? x : length - x);
  return new THREE.CubicBezierCurve(
    new THREE.Vector2(X(length), 0.24),
    new THREE.Vector2(X(length), 0.46),
    new THREE.Vector2(X(length - noseLength * 0.42), BODY_H),
    new THREE.Vector2(X(length - noseLength), BODY_H),
  );
}

// Extruded across the width with a deep bevel, so every edge reads as rounded clay
function extrude(shape, width) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL,
    bevelSegments: 8,
    curveSegments: 96,
  });
  g.computeBoundingBox();
  g.translate(0, 0, -(g.boundingBox.max.z + g.boundingBox.min.z) / 2);
  return g;
}

function roundRect(x, y, w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* The windscreen, as on real high-speed trains: one sweep of dark glass from
   near the nose tip up over the top of the cab, wider in the middle and
   tapering at both ends. Described as points along the car's edge, each with
   the direction pointing into the body and how deep the glass reaches there. */
function visorPath(length, noseLength, dir) {
  const X = (x) => (dir === 1 ? x : length - x);
  const curve = noseCurve(length, noseLength, dir);
  const inside = new THREE.Vector2(X(length * 0.4), BODY_H * 0.4);
  const path = [];
  for (let i = 0; i <= 40; i++) {
    const t = 0.12 + (i / 40) * 0.88;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    let n = new THREE.Vector2(-tan.y, tan.x);
    if (n.dot(inside.clone().sub(p)) < 0) n.negate();
    path.push({ p, n });
  }
  for (let i = 1; i <= 12; i++) {
    path.push({ p: new THREE.Vector2(X(length - noseLength - (i / 12) * VISOR_ROOF), BODY_H), n: new THREE.Vector2(0, -1) });
  }
  return path.map((q, i) => ({ ...q, depth: VISOR_DEPTH * Math.sin(Math.PI * (i / (path.length - 1))) ** 0.6 }));
}

const offsetAlong = (path, depth) => path.map(({ p, n, depth: d }) => p.clone().add(n.clone().multiplyScalar(depth(d))));

// The whole glass area in profile, reaching well past the edge, so paint seen
// at a glancing angle (and so blurred) never picks up the body colour there
function visorOutline(path) {
  return [...offsetAlong(path, () => -0.08), ...offsetAlong(path, (d) => d).reverse()];
}

/* The windscreen is painted onto the body, not laid over it. Each point of the
   body takes its paint from where it sits in profile, so one drawing of the
   glass covers the flat side, the rounded edge and the top, with one smooth
   edge and no seams between pieces. */
const PAINT_PX = 300;   // paint pixels per scene unit, about 3x the most the canvas ever draws
const PAINT_PAD = 0.1;  // room around the profile

function paintBody(geometry, length, outline, { body, glass }) {
  const x0 = -PAINT_PAD;
  const y0 = -PAINT_PAD;
  const w = length + PAINT_PAD * 2;
  const h = BODY_H + PAINT_PAD * 2;

  // The paint is laid on from the side, by each point's place in profile
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - x0) / w;
    uv[i * 2 + 1] = (pos.getY(i) - y0) / h;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  function layer(bodyPaint, glassPaint) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * PAINT_PX);
    canvas.height = Math.round(h * PAINT_PX);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bodyPaint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = glassPaint;
    ctx.beginPath();
    outline.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo']((p.x - x0) * PAINT_PX, (h - (p.y - y0)) * PAINT_PX));
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }

  const map = layer(`#${body.color.getHexString()}`, `#${glass.color.getHexString()}`);
  map.colorSpace = THREE.SRGBColorSpace;
  // Green holds how rough each part is and blue how metallic, as three.js reads them
  const finish = ({ roughness, metalness }) => `rgb(0, ${Math.round(roughness * 255)}, ${Math.round(metalness * 255)})`;
  const surface = layer(finish(body), finish(glass));
  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap: surface,
    metalnessMap: surface,
    roughness: 1,
    metalness: 1,
    envMapIntensity: body.envMapIntensity,
  });
}

function makeWheel(materials) {
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.06, 40), materials.dark);
  rim.rotation.x = Math.PI / 2;
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R * 0.62, 32), materials.hub);
  hub.position.z = 0.031;
  wheel.add(hub);
  // Three bolts off-centre make the spin easy to read
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R * 0.13, 16), materials.dark);
    bolt.position.set(Math.cos(a) * WHEEL_R * 0.36, Math.sin(a) * WHEEL_R * 0.36, 0.033);
    wheel.add(bolt);
  }
  return wheel;
}

function makeCar({ length, noseLength, dir, materials, wheels }) {
  const car = new THREE.Group();
  const front = BODY_W / 2 + 0.003; // just in front of the flat side facing the camera

  // The body, with its windscreen painted on
  const bodyGeometry = extrude(carShape(length, noseLength, dir), BODY_W);
  const outline = visorOutline(visorPath(length, noseLength, dir));
  const body = new THREE.Mesh(bodyGeometry, paintBody(bodyGeometry, length, outline, materials));
  body.castShadow = true;
  body.receiveShadow = true;
  car.add(body);

  // The driver's side window just behind the windscreen, then the passenger windows
  const cabX = length - noseLength - VISOR_ROOF - 0.08;
  const cab = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(dir === 1 ? cabX - 0.2 : length - cabX, 0.47, 0.2, 0.24, 0.07), 6), materials.glass);
  cab.position.z = front;
  car.add(cab);

  // A near-continuous band of windows with thin pillars, as on modern stock,
  // kept clear of the driver's window on both cars
  const start = dir === 1 ? 0.26 : length - cabX + 0.32;
  const end = dir === 1 ? cabX - 0.32 : length - 0.26;
  const count = Math.max(1, Math.round((end - start) / 0.42));
  const pane = (end - start - (count - 1) * 0.05) / count;
  for (let i = 0; i < count; i++) {
    const win = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(start + i * (pane + 0.05), 0.5, pane, 0.2, 0.05), 6), materials.glass);
    win.position.z = front;
    car.add(win);
  }

  // Bogies: a dark frame with two wheels each, showing below the skirt
  const bogieXs = [0.62, length - (dir === 1 ? noseLength * 0.55 : 0.62)];
  if (dir === -1) bogieXs[0] = noseLength * 0.55;
  for (const bx of bogieXs) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, BODY_W * 0.78), materials.dark);
    frame.position.set(bx, -0.02, 0);
    car.add(frame);
    for (const dx of [-0.23, 0.23]) {
      const wheel = makeWheel(materials);
      wheel.position.set(bx + dx, -WHEEL_R * 0.05, BODY_W * 0.4);
      car.add(wheel);
      wheels.push(wheel);
    }
  }
  return car;
}

/* ---------- Scene ---------- */
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sky = color('--tt-scene-sky');
  const scene = new THREE.Scene();
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 16, 40);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  // Side view, a touch above the track; the train sits low, under the card's title
  const camera = new THREE.PerspectiveCamera(22, 2, 0.1, 120);
  camera.position.set(0, 2.25, 10.5);
  camera.lookAt(0, 1.13, 0);

  /* Light: soft fill from the sky, one warm key low from behind on the left,
     so the train's side stays soft and long shadows fall forward and right */
  scene.add(new THREE.HemisphereLight(color('--tt-scene-fill'), color('--tt-scene-ground'), Number(token('--tt-scene-fill-power'))));
  const sun = new THREE.DirectionalLight(color('--tt-scene-light'), 3.1);
  sun.position.set(-7, 4.5, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const matte = (name, roughness = 0.75) => new THREE.MeshStandardMaterial({ color: color(name), roughness, envMapIntensity: 0.2 });
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: color('--tt-scene-train'), roughness: 0.4, envMapIntensity: 0.45 }),
    // Pulled toward the camera in the depth test, so glass laid on the body never flickers
    glass: new THREE.MeshStandardMaterial({
      color: color('--tt-scene-glass'), roughness: 0.34, metalness: 0.1, envMapIntensity: 0.6,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    dark: matte('--tt-scene-steel', 0.5),
    hub: matte('--tt-scene-hub', 0.4),
    slab: matte('--tt-scene-slab', 0.8),
    groove: matte('--tt-scene-groove', 0.6),
    ground: matte('--tt-scene-ground', 0.95),
    pole: matte('--tt-scene-pole', 0.6),
    leaves: ['--tt-scene-leaf-1', '--tt-scene-leaf-2', '--tt-scene-leaf-3'].map((n) => Object.assign(matte(n, 0.85), { flatShading: true })),
    trunk: matte('--tt-scene-trunk', 0.9),
    hill: matte('--tt-scene-hill', 0.95),
  };

  /* Ground and the slab track */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(120, SLAB_H, 1.5), materials.slab);
  slab.position.y = SLAB_H / 2;
  slab.castShadow = true;
  slab.receiveShadow = true;
  scene.add(slab);

  for (const z of [-RAIL_Z, RAIL_Z]) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(120, 0.01, 0.05), materials.groove);
    groove.position.set(0, SLAB_H + 0.005, z);
    scene.add(groove);
  }

  // Moving bits: each mesh keeps its layer and where it starts along the line
  const movers = [];
  const along = (mesh, layer, x0) => movers.push({ mesh, span: LAYERS[layer].span, x0 });

  // Comb-like teeth along both rails
  const teethCount = Math.round(LAYERS.teeth.span / LAYERS.teeth.gap);
  const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.018, 0.11), materials.groove, teethCount * 2);
  teeth.receiveShadow = true;
  scene.add(teeth);

  // Joints on the slab's front face, the fastest cue right under the train
  const jointCount = Math.round(LAYERS.joints.span / LAYERS.joints.gap);
  const joints = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, SLAB_H * 0.8, 0.01), materials.groove, jointCount);
  scene.add(joints);

  // Catenary poles behind the track, with one long static wire
  const poleCount = Math.round(LAYERS.poles.span / LAYERS.poles.gap);
  for (let i = 0; i < poleCount; i++) {
    const pole = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.75, 12), materials.pole);
    post.position.y = 0.875;
    pole.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.75), materials.pole);
    arm.position.set(0, 1.62, 0.36);
    pole.add(arm);
    pole.position.z = -0.95;
    pole.children.forEach((m) => { m.castShadow = true; });
    scene.add(pole);
    along(pole, 'poles', i * LAYERS.poles.gap);
  }
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 120, 6), materials.pole);
  wire.rotation.z = Math.PI / 2;
  wire.position.set(0, 1.6, -0.2);
  scene.add(wire);

  // Trees in loose clusters, and soft hills far back
  const rand = random(7);
  for (let i = 0; i < 26; i++) {
    const tree = new THREE.Group();
    const tall = rand() < 0.3;
    const size = 0.35 + rand() * 0.4;
    const height = size * (tall ? 4.4 : 3.2);
    const leaves = new THREE.Mesh(pine(height * (tall ? 0.24 : 0.3), height, (i + 1) * 104729), materials.leaves[Math.floor(rand() * 3)]);
    leaves.position.y = 0.14;
    leaves.castShadow = true;
    tree.add(leaves);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8), materials.trunk);
    trunk.position.y = 0.2;
    tree.add(trunk);
    tree.position.z = -2.6 - rand() * 5;
    tree.children.forEach((m) => { m.receiveShadow = true; });
    scene.add(tree);
    along(tree, 'trees', rand() * LAYERS.trees.span);
  }
  // Low bushes in front of the track: the closest layer, so the fastest
  for (let i = 0; i < 6; i++) {
    const size = 0.16 + rand() * 0.14;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), materials.leaves[Math.floor(rand() * 3)]);
    bush.scale.y = 0.62;
    bush.position.set(0, size * 0.3, 1.9 + rand() * 1.2);
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
    along(bush, 'bushes', i * (LAYERS.bushes.span / 6) + rand() * 1.2);
  }
  for (let i = 0; i < 9; i++) {
    const r = 3 + rand() * 4;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), materials.hill);
    hill.scale.y = 0.42 + rand() * 0.2;
    hill.position.set(0, -r * 0.08, -13 - rand() * 8);
    scene.add(hill);
    along(hill, 'hills', i * (LAYERS.hills.span / 9) + rand() * 2);
  }

  /* The train: a lead car with a long nose and a short tail car */
  const wheels = [];
  const train = new THREE.Group();
  const lead = makeCar({ length: 3.6, noseLength: 1.55, dir: 1, materials, wheels });
  const tail = makeCar({ length: 2.75, noseLength: 1.05, dir: -1, materials, wheels });
  lead.position.x = 0.06;
  tail.position.x = -2.75 - 0.06;
  const link = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, BODY_W * 0.72), materials.dark);
  link.position.set(0, 0.42, 0);
  train.add(lead, tail, link);
  train.position.set(-0.42, SLAB_H + WHEEL_R, 0);
  scene.add(train);

  const dummy = new THREE.Object3D();

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Draw the world as it is `distance` units down the line
  function render({ distance }) {
    for (const m of movers) m.mesh.position.x = wrap(m.x0 - distance, m.span);

    let i = 0;
    for (let k = 0; k < teethCount; k++) {
      const x = wrap(k * LAYERS.teeth.gap - distance, LAYERS.teeth.span);
      for (const z of [-RAIL_Z, RAIL_Z]) {
        dummy.position.set(x, SLAB_H + 0.004, z);
        dummy.updateMatrix();
        teeth.setMatrixAt(i++, dummy.matrix);
      }
    }
    teeth.instanceMatrix.needsUpdate = true;

    for (let k = 0; k < jointCount; k++) {
      dummy.position.set(wrap(k * LAYERS.joints.gap - distance, LAYERS.joints.span), SLAB_H / 2, 0.755);
      dummy.updateMatrix();
      joints.setMatrixAt(k, dummy.matrix);
    }
    joints.instanceMatrix.needsUpdate = true;

    // Wheels roll without slipping; the body glides, smooth and quiet
    const turn = -distance / WHEEL_R;
    for (const w of wheels) w.rotation.z = turn;

    renderer.render(scene, camera);
  }

  resize();
  // Draw once while the card is still closed, so the first open doesn't stall setting up the paint
  render({ distance: 0 });
  return { render, resize };
}
