// My Design Lab: study cards on a sphere you turn by dragging, scrolling or
// with the keyboard, the 3D logo in the middle, and a viewer that plays the
// chosen study live without leaving the page.
import * as THREE from 'three';
import { initMenu, initPageTransitions } from './shared.js';
import { createIcon } from '../micro-interactions/004-brand-board/icon.js';

const { gsap } = window;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const $ = (s, el = document) => el.querySelector(s);

initMenu(null);
const { entered } = initPageTransitions(reducedMotion);

const stage = $('[data-lab-stage]');
const sphere = $('[data-lab-sphere]');
const puck = $('[data-lab-puck]');

/* ---------- Studies ---------- */
const studies = [...$('[data-lab-list]').children].map((li) => {
  const study = {
    slug: li.dataset.slug,
    title: li.dataset.title,
    kind: li.dataset.kind,
    ratio: li.dataset.ratio || 'landscape', // landscape 4:3, portrait 4:5, square 1:1
    image: li.dataset.type === 'image',      // a still shot instead of a live page
  };
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${study.title}, ${study.kind.toLowerCase()}. ${study.image ? 'Opens it large.' : 'Opens it live.'}`;
  li.append(button);
  study.button = button;
  return study;
});

/* ---------- Sphere ---------- */
const DRIFT = { x: 36, y: 14 };  // px/s at the peak of the idle sway
const FRICTION = 4;              // how fast a fling slows down (per second)
const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(1, 0, 0);
const GAP = 1.7;                 // space between cards, in card widths

// Turned by yaw (left/right) and pitch (up/down) only, so cards never roll sideways
const view = { yaw: 0, pitch: 0 };
const rotation = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, 'XYZ');
const matrix = new THREE.Matrix4();
const normal = new THREE.Vector3();
const velocity = { x: 0, y: 0 };
let radius = 1;
let cards = [];

function cardWidth() {
  const probe = document.createElement('div');
  probe.className = 'lab-card';
  stage.append(probe);
  const w = probe.offsetWidth || 200; // the card's resolved width at this viewport
  probe.remove();
  return w;
}

// A very wide sphere: what's on screen is a gentle curve, close to flat, and
// the rest is open space to drag through
const sphereRadius = () => Math.max(window.innerWidth, window.innerHeight) * 1.6;

// Fibonacci points: an even spread over the sphere, with no seams or poles.
// The slots are spaced to the card size, and the studies take the ones
// closest to the front, around the logo (the slots behind it stay empty).
function slots(w) {
  const gap = (w * GAP) / radius;                   // angle between neighbours
  const count = Math.ceil((4 * Math.PI) / (gap * gap));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const logo = $('.lab__logo').offsetWidth;
  const clear = Math.cos((logo * 0.7 + w * 0.55) / radius);
  const points = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(1 - y * y);
    const p = new THREE.Vector3(Math.cos(i * golden) * r, y, Math.sin(i * golden) * r);
    if (p.z < clear) points.push(p);
  }
  return points.sort((a, b) => b.z - a.z);
}

function buildCards() {
  sphere.replaceChildren();
  cards = studies.map((study) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = study.ratio === 'landscape' ? 'lab-card' : `lab-card lab-card--${study.ratio}`;
    el.tabIndex = -1; // keyboards use the list; the cards mirror it
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<img src="../assets/lab/${study.slug}.webp" alt="" width="640" height="${{ landscape: 480, portrait: 800, square: 640 }[study.ratio]}" draggable="false" decoding="async">`;
    sphere.append(el);
    return { el, n: new THREE.Vector3(), study, opacity: -1 };
  });
  layout();
}

// Each card faces out from the centre, kept upright
function layout() {
  radius = sphereRadius();
  stage.style.setProperty('--lab-perspective', `${radius * 2.5}px`);
  const points = slots(cardWidth());
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const m = new THREE.Matrix4();
  cards.forEach((card, i) => {
    const n = card.n.copy(points[i]);
    x.crossVectors(UP, n);
    if (x.lengthSq() < 1e-4) x.copy(SIDE);
    x.normalize();
    y.crossVectors(n, x);
    m.makeBasis(x, y, n).setPosition(n.x * radius, n.y * radius, n.z * radius);
    card.el.style.transform = `matrix3d(${m.elements.join(',')})`;
  });
}

// Screen pixels to a turn: the front of the sphere follows the pointer 1:1
function turn(dx, dy) {
  view.yaw += dx / radius;
  view.pitch -= dy / radius;
}

function render() {
  euler.set(view.pitch, view.yaw, 0);
  rotation.setFromEuler(euler);
  matrix.makeRotationFromQuaternion(rotation);
  // The sphere's front touches the screen plane, so a card in front is shown at its real size
  sphere.style.transform = `translateZ(${-radius}px) matrix3d(${matrix.elements.join(',')})`;
  // Cards fade out as they curve away
  cards.forEach((card) => {
    normal.copy(card.n).applyQuaternion(rotation);
    const o = Math.min(1, Math.max(0, (normal.z - 0.55) / 0.2));
    if (Math.abs(o - card.opacity) < 0.01) return;
    card.opacity = o;
    card.el.style.opacity = o;
    card.el.style.pointerEvents = o > 0.4 ? '' : 'none';
  });
}

/* ---------- Drag, fling, wheel ---------- */
let dragging = null;
let hovering = false;
let paused = false; // while the viewer is open

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragging = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId };
  velocity.x = 0;
  velocity.y = 0;
});
window.addEventListener('pointermove', (e) => {
  if (dragging && e.pointerId === dragging.id) {
    const now = performance.now();
    const dx = e.clientX - dragging.x;
    const dy = e.clientY - dragging.y;
    const dt = Math.max(1, now - dragging.t) / 1000;
    turn(dx, dy);
    // Smoothed, so the fling carries the last few moves, not one jittery frame
    velocity.x = velocity.x * 0.6 + (dx / dt) * 0.4;
    velocity.y = velocity.y * 0.6 + (dy / dt) * 0.4;
    dragging.moved += Math.abs(dx) + Math.abs(dy);
    Object.assign(dragging, { x: e.clientX, y: e.clientY, t: now });
    if (dragging.moved > 6) {
      stage.classList.add('is-dragging');
      if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
      puck.classList.remove('is-visible');
    }
  }
  movePuck(e);
});
const endDrag = (e) => {
  if (!dragging || e.pointerId !== dragging.id) return;
  // A pause before letting go means no fling
  if (performance.now() - dragging.t > 80) { velocity.x = 0; velocity.y = 0; }
  if (reducedMotion) { velocity.x = 0; velocity.y = 0; }
  dragging.ended = true;
  stage.classList.remove('is-dragging');
  setTimeout(() => { dragging = null; });
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const scale = e.deltaMode === 1 ? 16 : 1; // lines to pixels
  if (reducedMotion) { turn(-e.deltaX * scale, -e.deltaY * scale); return; }
  velocity.x -= e.deltaX * scale * 3;
  velocity.y -= e.deltaY * scale * 3;
}, { passive: false });

/* ---------- Cursor puck ---------- */
const puckX = gsap.quickTo(puck, 'x', { duration: 0.35, ease: 'power3.out' });
const puckY = gsap.quickTo(puck, 'y', { duration: 0.35, ease: 'power3.out' });
function movePuck(e) {
  puckX(e.clientX - puck.offsetWidth / 2);
  puckY(e.clientY - puck.offsetHeight / 2);
}
stage.addEventListener('pointerover', (e) => {
  const over = !!e.target.closest('.lab-card');
  hovering = over;
  puck.classList.toggle('is-visible', over && finePointer.matches && !stage.classList.contains('is-dragging'));
});
stage.addEventListener('pointerleave', () => {
  hovering = false;
  puck.classList.remove('is-visible');
});

/* ---------- Open a card ---------- */
sphere.addEventListener('click', (e) => {
  const el = e.target.closest('.lab-card');
  if (!el || (dragging && dragging.moved > 6)) return;
  const card = cards.find((c) => c.el === el);
  openViewer(card.study, el);
});

/* ---------- Keyboard: the list turns the matching card to the front ---------- */
let focusTween;
let focused = null;
function bringToFront(study) {
  const card = cards.find((c) => c.study === study);
  const { x, y, z } = card.n;
  // The yaw and pitch that put this card straight ahead, taking the short way round
  const wrap = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const yaw = wrap(view.yaw, Math.atan2(-x, z));
  const pitch = wrap(view.pitch, Math.atan2(y, Math.hypot(x, z)));
  velocity.x = 0;
  velocity.y = 0;
  focusTween?.kill();
  focusTween = gsap.to(view, { yaw, pitch, duration: reducedMotion ? 0 : 0.8, ease: 'power3.inOut' });
  return card;
}

studies.forEach((study) => {
  study.button.addEventListener('focus', () => {
    focused?.el.classList.remove('is-focus');
    focused = bringToFront(study);
    focused.el.classList.add('is-focus');
  });
  study.button.addEventListener('blur', () => {
    focused?.el.classList.remove('is-focus');
    focused = null;
  });
  study.button.addEventListener('click', () => openViewer(study, (focused || bringToFront(study)).el));
});

/* ---------- Viewer ---------- */
const viewer = $('[data-lab-viewer]');
const panel = $('[data-lab-panel]');
const frame = $('[data-lab-frame]');
const shot = $('[data-lab-image]');
const backdrop = document.createElement('div');
backdrop.className = 'lab-viewer__backdrop';
viewer.prepend(backdrop);
let returnFocus = null;
let closing = false;

function openViewer(study, origin) {
  returnFocus = document.activeElement;
  $('[data-lab-name]').textContent = study.title;
  $('[data-lab-kind]').textContent = study.kind;
  const url = study.image ? `../assets/lab/full/${study.slug}.webp` : `../micro-interactions/${study.slug}/`;
  $('[data-lab-open]').href = url;
  viewer.dataset.ratio = study.ratio;
  frame.hidden = study.image;
  shot.hidden = !study.image;
  if (study.image) {
    shot.src = url;
    shot.alt = study.title;
  } else {
    frame.title = `${study.title}, live`;
    frame.src = url;
  }
  paused = true;
  puck.classList.remove('is-visible');
  viewer.showModal();

  if (reducedMotion) return;
  // Grow out of the card that was clicked
  const from = origin.getBoundingClientRect();
  const to = panel.getBoundingClientRect();
  gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  gsap.fromTo(panel, {
    x: from.left + from.width / 2 - (to.left + to.width / 2),
    y: from.top + from.height / 2 - (to.top + to.height / 2),
    scale: from.width / to.width,
    opacity: 0.4,
  }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' });
}

function closeViewer() {
  if (closing || !viewer.open) return;
  closing = true;
  const done = () => {
    viewer.close();
    frame.removeAttribute('src');
    shot.removeAttribute('src');
    gsap.set([panel, backdrop], { clearProps: 'all' });
    paused = false;
    closing = false;
    returnFocus?.focus({ preventScroll: true });
  };
  if (reducedMotion) { done(); return; }
  gsap.timeline({ onComplete: done })
    .to(panel, { opacity: 0, y: 24, scale: 0.97, duration: 0.25, ease: 'power2.in' }, 0)
    .to(backdrop, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0);
}

$('[data-lab-close]').addEventListener('click', closeViewer);
backdrop.addEventListener('click', closeViewer);
viewer.addEventListener('cancel', (e) => {
  e.preventDefault(); // Escape: run the closing motion first
  closeViewer();
});

/* ---------- Logo ---------- */
const LOGO_PERIOD = 20;
const SPIN_SECONDS = 18; // one full turn of the logo
const world = { t: 0, tiltX: 0, tiltY: 0, explode: 0, spin: 0 };
const icon = createIcon($('.lab__logo-canvas'), $('#logo-path').getAttribute('d'), {
  period: LOGO_PERIOD,
  scale: 0.65, // the canvas is twice the icon's size, so the shards have room
});
let breaking = false;
$('[data-lab-logo]').addEventListener('click', () => {
  if (breaking) return;
  breaking = true;
  gsap.timeline({ onComplete: () => { breaking = false; } })
    .to(world, { explode: 1, duration: reducedMotion ? 0 : 0.9, ease: 'power2.out' })
    .to(world, { explode: 0, duration: reducedMotion ? 0 : 1.2, ease: 'power3.inOut' }, reducedMotion ? 0.6 : 1.45);
});

/* ---------- Frame loop ---------- */
gsap.ticker.add((time, deltaTime) => {
  if (paused) return;
  const dt = Math.min(deltaTime / 1000, 0.1);
  if (!dragging || dragging.ended) {
    if (!reducedMotion) {
      // The fling eases out into a slow sway that comes back on itself, so the
      // cards never wander off to the empty side; hovering a card holds it still
      const drift = hovering ? 0 : 1;
      const k = Math.exp(-FRICTION * dt);
      velocity.x = velocity.x * k + DRIFT.x * Math.sin(time * 0.21) * drift * (1 - k);
      velocity.y = velocity.y * k + DRIFT.y * Math.cos(time * 0.17) * drift * (1 - k);
    }
    if (velocity.x || velocity.y) turn(velocity.x * dt, velocity.y * dt);
  }
  render();

  if (!reducedMotion) {
    world.t = (world.t + dt) % LOGO_PERIOD;
    world.spin = (world.spin + (dt / SPIN_SECONDS) * Math.PI * 2) % (Math.PI * 2);
    // The logo leans with the canvas as it moves
    const lean = (v) => Math.max(-1, Math.min(1, v / 1200));
    world.tiltX += (lean(velocity.x) - world.tiltX) * 0.08;
    world.tiltY += (lean(-velocity.y) - world.tiltY) * 0.08;
  }
  icon.render(world);
});

/* ---------- Start ---------- */
buildCards();
// Start a little off, so the entrance spin settles with the studies around the logo
if (!reducedMotion) turn(-120, 25);
render();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    icon.resize();
    layout();
  }, 150);
});

if (!reducedMotion) {
  gsap.set(stage, { opacity: 0, scale: 0.92 });
  entered.then(() => {
    gsap.to(stage, { opacity: 1, scale: 1, duration: 1.4, ease: 'expo.out' });
    // A gentle spin as it settles in
    velocity.x = 480;
    velocity.y = -100;
  });
}
