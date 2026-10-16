/* ==========================================================================
   002 · Train tracker
   A "Track my train" button grows into a trip card. While the trip loads, the
   blocks show as skeletons; then a soft 3D train rolls along in the card while
   the world slides past it. Closing folds the card back into the button.
   The trip details are illustrative.
   ========================================================================== */
import { createScene } from './scene.js';

const token = Loop.token;
const stage = document.querySelector('.stage');
const tracker = stage.querySelector('.tracker');
const title = tracker.querySelector('.tracker__title');
const toggle = tracker.querySelector('.tracker__toggle');
const close = tracker.querySelector('.tracker__close');
const hero = tracker.querySelector('.hero');
const canvas = tracker.querySelector('.hero__canvas');
const skeletons = [...tracker.querySelectorAll('.sk')];
const contents = [...tracker.querySelectorAll('.slot__content')];
const route = tracker.querySelector('.route');
const etaNow = tracker.querySelector('.eta__now');
const etaNext = tracker.querySelector('.eta__next');

const SPEED = 2.4;        // scene units per second
const OPEN_RADIUS = 28;
const PILL_H = 48;
const PILL_PAD = 22;

// Everything in the 3D scene is drawn from this
const world = { distance: 0 };
const scene = createScene(canvas);

/* ---------- The pill the card closes into ---------- */
let pill;
const openClip = { '--clip-x': '0px', '--clip-y': '0px', '--clip-r': `${OPEN_RADIUS}px` };

// Measured from the laid-out card, so it holds at any scale
function measure() {
  const w = tracker.offsetWidth;
  const h = tracker.offsetHeight;
  const pw = title.offsetWidth + PILL_PAD * 2;
  const x = (w - pw) / 2;
  const y = (h - PILL_H) / 2;
  pill = {
    clip: { '--clip-x': `${x}px`, '--clip-y': `${y}px`, '--clip-r': `${PILL_H / 2}px` },
    dx: (w - title.offsetWidth) / 2 - title.offsetLeft,
    dy: (h - title.offsetHeight) / 2 - title.offsetTop,
  };
  Object.assign(toggle.style, { top: `${y}px`, left: `${x}px`, width: `${pw}px`, height: `${PILL_H}px` });
}

// Closed, as the loop starts and as a visitor first finds it
function setBase() {
  gsap.set(tracker, pill.clip);
  gsap.set(title, { x: pill.dx, y: pill.dy });
  toggle.hidden = false;
  toggle.disabled = false;
  toggle.setAttribute('aria-expanded', 'false');
  delete hero.dataset.offline;
}

/* ---------- Motion pieces, shared by the loop and by live clicks ---------- */
/* The dark button lights up white as it's pressed, then grows into the card.
   The swap is quick and happens while it's still pill-sized, so the in-between
   grey is never on screen long. Closing shrinks it white and darkens it last. */
const SWAP = 0.15;

function light(tl, at, on) {
  tl.to(tracker, { backgroundColor: token(on ? '--tt-card' : '--tt-button'), duration: SWAP, ease: 'power1.inOut' }, at)
    .to(title, { color: token(on ? '--tt-text' : '--tt-on-button'), duration: SWAP, ease: 'power1.inOut' }, at);
}

function expand(tl, at) {
  light(tl, at - 0.05, true);
  tl.to(tracker, { ...openClip, duration: 0.7, ease: 'power3.inOut' }, at)
    .to(title, { x: 0, y: 0, duration: 0.7, ease: 'power3.inOut' }, at);
}

function shrink(tl, at) {
  tl.to(tracker, { ...pill.clip, duration: 0.6, ease: 'power3.inOut' }, at)
    .to(title, { x: pill.dx, y: pill.dy, duration: 0.6, ease: 'power3.inOut' }, at);
  light(tl, at + 0.5, false);
}

// Skeletons first, with a sweep of light while the trip loads
function load(tl, at, duration) {
  tl.fromTo(skeletons, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.05, immediateRender: false }, at)
    .fromTo(skeletons, { backgroundPosition: '100% 0' },
      { backgroundPosition: '0% 0', duration, ease: 'none', immediateRender: false }, at);
}

// Then each block sharpens in where its skeleton was
function reveal(tl, at) {
  tl.to(skeletons, { autoAlpha: 0, duration: 0.2, stagger: 0.06 }, at)
    .fromTo(contents, { autoAlpha: 0, y: 8, filter: 'blur(6px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power3.out', stagger: 0.06, immediateRender: false }, at)
    .fromTo(close, { autoAlpha: 0, scale: 0.6, y: 0, filter: 'blur(0px)' },
      { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)', immediateRender: false }, at + 0.1);
}

function conceal(tl, at) {
  tl.to([close, ...contents].reverse(), { autoAlpha: 0, y: -4, filter: 'blur(4px)', duration: 0.2, stagger: 0.03 }, at);
}

// A minute goes by: 48 rolls up and 47 comes in under it
function tick(tl, at) {
  tl.to(etaNow, { yPercent: -100, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, at)
    .fromTo(etaNext, { yPercent: 100, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out', immediateRender: false }, at + 0.15);
}

/* ---------- The loop ---------- */
function restPoint() {
  const s = stage.getBoundingClientRect();
  const c = tracker.getBoundingClientRect();
  return { x: Math.min(c.right - s.left + 28, s.width - 28), y: c.top - s.top + c.height * 0.62 };
}

const END = 12;

function build(tl, cursor) {
  const rest = restPoint();
  const OPEN = 1.65;   // the button gives way to the card
  const LOAD = 2.15;   // skeletons in
  const SHOW = 2.85;   // trip in
  const CLOSE = 10.1;  // the close button takes the click

  // The world keeps sliding the whole time; it's only seen while the card is open
  tl.fromTo(world, { distance: 0 }, { distance: SPEED * END, duration: END, ease: 'none' }, 0);
  cursor.set(rest, 0);

  // 1. Hover, press, and the button grows into the card
  cursor.move(tracker, 0.4, { duration: 0.95, ox: 0.56, oy: 0.52 });
  tl.to(tracker, { backgroundColor: token('--tt-button-hover'), duration: 0.15 }, 1.3);
  cursor.press(OPEN - 0.1);
  tl.to(tracker, { scale: 0.97, duration: 0.1, ease: 'power2.out' }, OPEN - 0.1)
    .to(tracker, { scale: 1, duration: 0.35, ease: 'back.out(2)' }, OPEN);
  expand(tl, OPEN);

  // 2. The trip loads, then shows
  load(tl, LOAD, 0.75);
  reveal(tl, SHOW);
  cursor.move(rest, SHOW + 0.2, { duration: 0.9 });

  // 3. The train rolls on; the trip moves along and a minute ticks by
  tl.fromTo(route, { '--tt-progress': 0.58 }, { '--tt-progress': 0.63, duration: CLOSE - SHOW, ease: 'none' }, SHOW);
  tick(tl, 7.2);

  // 4. Close, and the card folds back into the button
  cursor.move(close, CLOSE - 0.95, { duration: 0.85 });
  tl.to(close, { backgroundColor: token('--tt-control-hover'), duration: 0.15 }, CLOSE - 0.2);
  cursor.press(CLOSE);
  conceal(tl, CLOSE + 0.05);
  shrink(tl, CLOSE + 0.25);
  cursor.move(rest, CLOSE + 0.5, { duration: 0.95 });
}

/* ---------- Live: the visitor opens and closes it ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let live = null;

function play(sequence) {
  let tl;
  live.ctx.add(() => {
    tl = gsap.timeline();
    sequence(tl);
  });
  if (reduce) tl.progress(1);
  return tl;
}

// Reverting the loop drops the clip variables, so the pill is set again first
function startLive() {
  setBase();
  live = { open: false, busy: false, ctx: gsap.context(() => {}, stage) };
}

function stopLive() {
  if (live) live.ctx.revert();
  live = null;
  setBase();
}

function showOffline(offline) {
  if (offline) hero.dataset.offline = '';
  else delete hero.dataset.offline;
}

function openCard() {
  if (!live || live.open || live.busy) return;
  live.busy = true;
  toggle.disabled = true;
  toggle.setAttribute('aria-expanded', 'true');
  showOffline(!navigator.onLine);
  play((tl) => {
    expand(tl, 0);
    load(tl, 0.45, 0.6);
    reveal(tl, 1.05);
    tl.eventCallback('onComplete', () => {
      live.open = true;
      live.busy = false;
      toggle.hidden = true;
      close.focus();
    });
  });
}

function closeCard() {
  if (!live || !live.open || live.busy) return;
  live.busy = true;
  play((tl) => {
    conceal(tl, 0);
    shrink(tl, 0.2);
    tl.eventCallback('onComplete', () => {
      // Colours go back to CSS, so the button's hover works again
      gsap.set([tracker, title], { clearProps: 'backgroundColor,color' });
      live.open = false;
      live.busy = false;
      toggle.hidden = false;
      toggle.disabled = false;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    });
  });
}

toggle.addEventListener('click', openCard);
close.addEventListener('click', closeCard);
tracker.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCard();
});
addEventListener('online', () => showOffline(false));
addEventListener('offline', () => showOffline(true));

/* ---------- Drawing the scene ---------- */
const isOpen = () => gsap.getProperty(hero, 'opacity') > 0;
let last = 0;

// On screen: draw every tick while the scene shows; live, the train keeps going
gsap.ticker.add((time) => {
  const dt = Math.min(time - last, 0.1);
  last = time;
  if (document.documentElement.dataset.mode === 'record' || !isOpen()) return;
  if (live && live.open && !reduce && !hero.hasAttribute('data-offline')) world.distance += SPEED * dt;
  scene.render(world);
});

/* ---------- Start ---------- */
Promise.all([
  document.fonts.load('800 30px "Manrope"'),
  document.fonts.load('700 19px "Manrope"'),
  document.fonts.load('600 16px "Manrope"'),
  document.fonts.load('500 12px "Manrope"'),
]).finally(() => {
  measure();
  setBase();
  scene.resize();
  Loop.start({
    build,
    fit: '.tracker-shadow',
    rest: 6,
    live: startLive,
    reset: stopLive,
    frame: () => scene.render(world),
  });
});
