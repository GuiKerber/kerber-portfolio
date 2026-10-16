/* ==========================================================================
   004 · Brand board
   The brand on one board, each tile answering the pointer the way the site
   does: the strings bend and glow, the 3D icon leans toward you and breaks
   apart on a click, the headline changes its last word, and a swatch copies
   its code.
   ========================================================================== */
import { createIcon } from './icon.js';
import { createStrings } from './strings.js';

const token = Loop.token;
const stage = document.querySelector('.stage');
const board = stage.querySelector('.board');
const iconCell = board.querySelector('.cell--icon');
const iconHit = board.querySelector('.icon__hit');
const sample = board.querySelector('.sample');
const typeHit = board.querySelector('.type__hit');
const words = [...board.querySelectorAll('.rotator__word')];
const spoken = board.querySelector('.rotator__spoken');
const swatches = [...board.querySelectorAll('.swatch')];
const accent = board.querySelector('.swatch--accent');
const copyStatus = board.querySelector('[data-copy-status]');
const BLUR = `blur(${token('--blur-reveal')})`;

const END = 14;
// Everything the canvases draw from
const world = { t: 0, tiltX: 0, tiltY: 0, explode: 0 };
const icon = createIcon(board.querySelector('.icon__canvas'), document.getElementById('logo-path').getAttribute('d'), { period: END });
const strings = createStrings(stage.querySelector('.strings'));
const draw = () => {
  icon.render(world);
  strings.draw();
};

/* ---------- Motion pieces, shared by the loop and by live clicks ---------- */
// The icon flies apart into prisms, hangs for a moment, and pulls back together
function shatter(tl, at) {
  tl.to(world, { explode: 1, duration: 0.9, ease: 'power2.out' }, at)
    .to(world, { explode: 0, duration: 1.2, ease: 'power3.inOut' }, at + 1.45);
}

// The headline's last word swaps, as in the site's hero
function nextWord(tl, at, from, to) {
  tl.to(words[from], { opacity: 0, filter: BLUR, yPercent: -20, duration: 0.3, ease: 'power2.in' }, at)
    .fromTo(words[to], { opacity: 0, filter: BLUR, yPercent: 20 },
      { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, at + 0.15);
}

// A swatch's code gives way to "Copied", then comes back
function showCopied(tl, at, swatch, hold) {
  const hex = swatch.querySelector('.swatch__hex');
  const done = swatch.querySelector('.swatch__done');
  tl.to(hex, { autoAlpha: 0, duration: 0.12 }, at)
    .fromTo(done, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out', immediateRender: false }, at + 0.08)
    .to(done, { autoAlpha: 0, duration: 0.15 }, at + hold)
    .to(hex, { autoAlpha: 1, duration: 0.2 }, at + hold + 0.1);
}

/* ---------- The loop ---------- */
function restPoint() {
  const s = stage.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  return { x: Math.min(b.right - s.left + 36, s.width - 28), y: b.top - s.top + b.height * 0.55 };
}

// A point on the stage, in the same pixels the strings are drawn in
const along = (m, d) => ({ x: m.x + m.nx * d, y: m.y + m.ny * d });

function build(tl, cursor) {
  const rest = restPoint();
  const PLUCK = 1.32;  // the pointer catches a string
  const BREAK = 3.4;   // the icon takes the click
  const WORD = 6.4;    // first click on the headline
  const COPY = 8.9;    // the accent swatch is copied

  strings.reset();
  tl.fromTo(world, { t: 0 }, { t: END, duration: END, ease: 'none' }, 0);
  cursor.set(rest, 0);

  // Comets now and then, each along its own string
  [[1, 0.3, 2.2], [3, 9.2, 2.2], [0, 11.6, 2]].forEach(([line, at, duration]) => {
    const comet = { line, t: -1 };
    strings.comets.push(comet);
    tl.fromTo(comet, { t: 0 }, { t: 1.15, duration, ease: 'none', immediateRender: false }, at);
  });

  // 1. The pointer drags across a string: it stretches, glows, and twangs back
  const line = strings.lines[4];
  const mid = strings.middle(line);
  cursor.move(along(mid, -70), 0.4, { duration: 0.6 });
  cursor.move(along(mid, 60), 1.05, { duration: 0.5, ease: 'none' });
  cursor.move(along(mid, 120), 1.55, { duration: 0.35, ease: 'power1.out' });
  tl.to(line.bend, { x: mid.nx * 88, y: mid.ny * 88, duration: 0.23, ease: 'none' }, PLUCK)
    .to(line.bend, { x: 0, y: 0, duration: 1.5, ease: 'elastic.out(1, 0.3)' }, PLUCK + 0.27)
    .to(line, { glow: 1, duration: 0.2, ease: 'power1.out' }, PLUCK)
    .to(line, { glow: 0, duration: 1.3, ease: 'power1.in' }, PLUCK + 0.3);

  // 2. The icon leans toward the pointer, breaks apart on the click, and rebuilds
  cursor.move(iconCell, BREAK - 1.3, { duration: 0.8, ox: 0.66, oy: 0.36 });
  tl.to(world, { tiltX: 0.5, tiltY: 0.4, duration: 1, ease: 'power2.out' }, BREAK - 1.1);
  cursor.press(BREAK - 0.08);
  shatter(tl, BREAK);
  tl.to(world, { tiltX: 0, tiltY: 0, duration: 1.2, ease: 'power2.inOut' }, BREAK + 2.2);

  // 3. Two clicks on the headline: launch. -> scale. -> convert.
  cursor.move(sample, WORD - 1, { duration: 0.8, ox: 0.62, oy: 0.7 });
  tl.to(sample, { color: token('--color-text-strong'), duration: 0.15 }, WORD - 0.3);
  cursor.press(WORD - 0.08);
  nextWord(tl, WORD, 0, 1);
  cursor.press(WORD + 0.82);
  nextWord(tl, WORD + 0.9, 1, 2);
  tl.to(sample, { color: token('--color-text'), duration: 0.2 }, COPY - 1.1);

  // 4. The accent swatch opens up, and its code is copied
  cursor.move(accent, COPY - 1.1, { duration: 0.8, ox: 0.3, oy: 0.5 });
  tl.to(accent, { '--grow': token('--bb-grow-hover'), duration: 0.3, ease: 'power2.out' }, COPY - 0.45);
  cursor.press(COPY - 0.08);
  tl.to(accent, { opacity: token('--opacity-pressed'), duration: 0.08 }, COPY - 0.08).to(accent, { opacity: 1, duration: 0.15 }, COPY + 0.04);
  showCopied(tl, COPY, accent, 1.3);
  cursor.move(rest, COPY + 1.25, { duration: 0.9 });
  tl.to(accent, { '--grow': token('--bb-grow-accent'), duration: 0.35, ease: 'power2.inOut' }, COPY + 1.45);

  // The headline finishes its round on its own and lands back on launch.
  nextWord(tl, COPY + 2, 2, 3);
  nextWord(tl, COPY + 3.7, 3, 0);
  tl.set({}, {}, END);
}

/* ---------- Live: the visitor's own pointer ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let live = null;
let lastT = 0; // where the idle sway was, so taking over doesn't jump it

function play(sequence) {
  let tl;
  live.ctx.add(() => {
    tl = gsap.timeline();
    sequence(tl);
  });
  if (reduce) tl.progress(1);
  return tl;
}

function startLive() {
  world.t = lastT;
  strings.reset();
  live = { ctx: gsap.context(() => {}, stage), word: 0, tilt: { x: 0, y: 0 }, pointer: null, nextComet: 1.2, breaking: false };
}

function stopLive() {
  if (live) live.ctx.revert();
  live = null;
  Object.assign(world, { tiltX: 0, tiltY: 0, explode: 0 });
  strings.reset();
  spoken.textContent = words[0].textContent;
  swatches.forEach((s) => delete s.dataset.state);
  copyStatus.textContent = '';
  iconHit.removeAttribute('aria-busy');
}

stage.addEventListener('pointermove', (e) => {
  if (!live) return;
  const s = stage.getBoundingClientRect();
  live.pointer = { x: e.clientX - s.left, y: e.clientY - s.top };
  // The icon leans toward the pointer while it's over its tile
  const c = iconCell.getBoundingClientRect();
  const inside = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom;
  live.tilt = inside
    ? { x: ((e.clientX - c.left) / c.width) * 2 - 1, y: 1 - ((e.clientY - c.top) / c.height) * 2 }
    : { x: 0, y: 0 };
});
stage.addEventListener('pointerleave', () => {
  if (!live) return;
  live.pointer = null;
  live.tilt = { x: 0, y: 0 };
});

iconHit.addEventListener('click', () => {
  if (!live || live.breaking) return;
  live.breaking = true;
  iconHit.setAttribute('aria-busy', 'true');
  play((tl) => {
    shatter(tl, 0);
    tl.eventCallback('onComplete', () => {
      if (!live) return;
      live.breaking = false;
      iconHit.removeAttribute('aria-busy');
    });
  });
});

typeHit.addEventListener('click', () => {
  if (!live) return;
  const from = live.word;
  live.word = (from + 1) % words.length;
  spoken.textContent = words[live.word].textContent;
  play((tl) => nextWord(tl, 0, from, live.word));
});

swatches.forEach((swatch) => {
  let timer;
  swatch.addEventListener('click', async () => {
    if (!live) return;
    const hex = swatch.dataset.hex;
    try {
      await navigator.clipboard.writeText(hex);
      swatch.dataset.state = 'copied';
      copyStatus.textContent = `Copied ${hex}`;
    } catch {
      swatch.dataset.state = 'failed';
      copyStatus.textContent = `Couldn't copy. The code is ${hex}.`;
    }
    clearTimeout(timer);
    timer = setTimeout(() => delete swatch.dataset.state, 1600);
  });
});

/* ---------- Drawing ---------- */
gsap.ticker.add((time, deltaTime) => {
  if (document.documentElement.dataset.mode === 'record') return;
  if (live) {
    const dt = Math.min(deltaTime / 1000, 0.1);
    if (!reduce) {
      world.t = (world.t + dt) % END;
      // Ease toward the pointer, as the site's hero does
      world.tiltX += (live.tilt.x - world.tiltX) * 0.08;
      world.tiltY += (live.tilt.y - world.tiltY) * 0.08;
      strings.step(dt, live.pointer);
      live.nextComet -= dt;
      if (live.nextComet <= 0) {
        strings.comets.push({ line: Math.floor(Math.random() * strings.lines.length), t: 0, speed: 0.35 + Math.random() * 0.35 });
        live.nextComet = 1.4 + Math.random() * 2.2;
      }
    }
  }
  lastT = world.t;
  draw();
});

/* ---------- Start ---------- */
addEventListener('resize', () => {
  icon.resize();
  strings.resize();
});

Promise.all([
  document.fonts.load('400 58px "Familjen Grotesk"'),
  document.fonts.load('500 32px "Familjen Grotesk"'),
  document.fonts.load('400 15px "Inter Tight"'),
  document.fonts.load('400 12px "Martian Mono"'),
]).finally(() => {
  icon.resize();
  strings.resize();
  Loop.start({ build, fit: '.board', rest: 9, live: startLive, reset: stopLive, frame: draw });
});
