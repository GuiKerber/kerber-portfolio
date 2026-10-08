import * as THREE from 'three';
import { token } from './tokens.js';

// A ribbon of image cards wrapped around a tilted helix. On scroll the whole
// spiral rises from below the screen to above it while the cards slide along
// the ribbon, sweeping over the industries text.

const CARD_W = 3.8;
const CARD_H = 2.85;
const GAP = 0.3;
const RADIUS = 6;
const PITCH = 0.1;          // rise per unit of arc length; keeps turns from overlapping
const SLIDE = 14;           // how far cards travel along the ribbon over the whole scroll
const ORBIT_OFFSET = CARD_H / 2 + 0.6;

const vertexShader = /* glsl */ `
  uniform float uOffset;
  uniform float uShift;
  uniform float uRadius;
  uniform float uPitch;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    vUv = uv;
    float s = uOffset + uShift + position.x;
    float a = s / uRadius;
    vec3 p = vec3(sin(a) * uRadius, position.y + s * uPitch, cos(a) * uRadius);
    vFacing = cos(a);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    // rounded corners
    float r = 0.06;
    vec2 p = (vUv - 0.5) * uSize;
    vec2 q = abs(p) - (uSize * 0.5 - r);
    float d = length(max(q, 0.0)) - r;
    float alpha = 1.0 - smoothstep(0.0, 0.012, d);
    if (alpha < 0.01) discard;

    // Cards on the far side of the spiral still show their image, unmirrored
    vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec3 col = texture2D(uMap, uv).rgb;
    col *= gl_FrontFacing ? 0.9 + 0.1 * vFacing : 0.86;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

export function createSpiral(canvas, sources, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  const group = new THREE.Group();
  group.rotation.set(-0.22, 0, 0.2);
  scene.add(group);

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 40, 1);
  const step = CARD_W + GAP;
  const length = sources.length * step;

  const materials = sources.map((src, i) => {
    const map = loader.load(src, () => { needsRender = true; });
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = maxAniso;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: map },
        uSize: { value: new THREE.Vector2(CARD_W, CARD_H) },
        uOffset: { value: i * step - length / 2 + CARD_W / 2 },
        uShift: { value: 0 },
        uRadius: { value: RADIUS },
        uPitch: { value: PITCH },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    return material;
  });

  // Thin orbit lines that trace a wider helix. They travel the opposite way:
  // down from the top while the image ribbon rises from the bottom.
  const orbits = new THREE.Group();
  orbits.rotation.copy(group.rotation);
  scene.add(orbits);
  const orbitEnd = length / 2 + SLIDE;
  const orbitMat = new THREE.LineBasicMaterial({ color: token('--color-orbit'), transparent: true, opacity: 0.55 });
  [ORBIT_OFFSET, -ORBIT_OFFSET].forEach((offset) => {
    const pts = [];
    for (let s = -orbitEnd; s <= orbitEnd; s += 0.25) {
      const a = s / RADIUS;
      const rad = RADIUS + 1.1;
      pts.push(new THREE.Vector3(Math.sin(a) * rad, offset + s * PITCH, Math.cos(a) * rad));
    }
    orbits.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitMat));
  });

  let progress = reducedMotion ? 0.5 : 0;
  let needsRender = true;
  let visible = false;
  let travel = 10;
  let orbitTravel = 10;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // pull back on narrow screens so the ribbon still reads as a spiral
    camera.position.z = 17 * Math.min(2.1, Math.max(1, 1.45 / camera.aspect));
    camera.updateProjectionMatrix();
    // vertical travel: from fully below the screen to fully above it
    const halfView = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - RADIUS);
    const halfSpiral = (length / 2 + SLIDE) * PITCH + CARD_H;
    // extra margin: the tilt makes the helix taller on screen than its own height
    travel = halfView + halfSpiral + 3;
    orbitTravel = halfView + orbitEnd * PITCH + ORBIT_OFFSET + 3;
    needsRender = true;
  }
  resize();
  window.addEventListener('resize', resize);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) resize();
  }).observe(canvas);

  function loop() {
    if (visible && needsRender) {
      const shift = -SLIDE + SLIDE * 2 * progress;
      materials.forEach((m) => { m.uniforms.uShift.value = shift; });
      group.position.y = -travel + travel * 2 * progress;
      orbits.position.y = orbitTravel - orbitTravel * 2 * progress;
      renderer.render(scene, camera);
      needsRender = false;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    setProgress(p) {
      if (reducedMotion) return;
      progress = p;
      needsRender = true;
    },
    resize,
  };
}
