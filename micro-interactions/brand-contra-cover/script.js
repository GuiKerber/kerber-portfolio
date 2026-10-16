/* ==========================================================================
   Contra cover (video)
   Reuses the brand board's icon and strings (004-brand-board): both draw
   from plain numbers, so the loop can seek to any frame and the last frame
   meets the first.
   ========================================================================== */
import { createIcon } from '../004-brand-board/icon.js';
import { createStrings } from '../004-brand-board/strings.js';

const stage = document.querySelector('.stage');
const flare = stage.querySelector('.cover__flare');

const END = 8;     // seconds per loop
const BREAK = 2.4; // the icon flies apart
const BACK = 4.4;  // ...and pulls back together

// The same lines as the still cover, kept clear of the copy
const LINES = [
  [-0.05, 0.08, 1.05, 0.36],
  [-0.05, 0.86, 1.05, 0.7],
  [0.56, -0.05, 0.8, 1.05],
  [0.98, -0.05, 0.5, 1.05],
  [1.05, 0.2, 0.6, 1.05],
];
const GLOW = 3; // the orange line
const GLOW_REST = 0.5;

const world = { t: 0, tiltX: 0, tiltY: 0, explode: 0 };
const icon = createIcon(stage.querySelector('.cover__icon'), document.getElementById('logo-path').getAttribute('d'), {
  period: END,
  spread: 0.85,  // nearly the full burst from the site's hero
  scale: 0.3956, // about 254 px wide inside the 1400 px canvas, as on the still
});
const strings = createStrings(stage.querySelector('.cover__strings'), LINES);
const draw = () => {
  icon.render(world);
  strings.draw();
};

function build(tl) {
  strings.reset();
  strings.lines[GLOW].glow = GLOW_REST;
  tl.fromTo(world, { t: 0 }, { t: END, duration: END, ease: 'none' }, 0);

  // Comets, each along its own line, all gone before the loop restarts
  [[0, 0.4, 2.4], [3, 5.2, 2], [1, 6.2, 1.6]].forEach(([line, at, duration]) => {
    const comet = { line, t: -1 };
    strings.comets.push(comet);
    tl.fromTo(comet, { t: 0 }, { t: 1.15, duration, ease: 'none', immediateRender: false }, at);
  });

  // The break: shards fly out, a bloom flashes, the orange line flares
  tl.to(world, { explode: 1, duration: 1, ease: 'power3.out' }, BREAK)
    .to(world, { explode: 0, duration: 1.7, ease: 'power3.inOut' }, BACK)
    .fromTo(flare, { opacity: 0, scale: 0.6 }, { opacity: 0.32, scale: 1, duration: 0.18, ease: 'power2.out', immediateRender: false }, BREAK)
    .to(flare, { opacity: 0, duration: 1.1, ease: 'power2.in' }, BREAK + 0.18)
    .to(strings.lines[GLOW], { glow: 1, duration: 0.15, ease: 'power1.out' }, BREAK)
    .to(strings.lines[GLOW], { glow: GLOW_REST, duration: 1.6, ease: 'power1.in' }, BREAK + 0.2);

  // ...and every line is pushed away from the icon, then twangs back
  const cx = parseFloat(Loop.token('--cc-icon-x'));
  const cy = parseFloat(Loop.token('--cc-icon-y'));
  strings.lines.forEach((line) => {
    const m = strings.middle(line);
    const away = Math.sign((m.x - cx) * m.nx + (m.y - cy) * m.ny) || 1;
    tl.to(line.bend, { x: m.nx * 28 * away, y: m.ny * 28 * away, duration: 0.16, ease: 'power2.out' }, BREAK + 0.02)
      .to(line.bend, { x: 0, y: 0, duration: 1.6, ease: 'elastic.out(1, 0.3)' }, BREAK + 0.18);
  });

  tl.set({}, {}, END);
}

gsap.ticker.add(() => {
  if (document.documentElement.dataset.mode !== 'record') draw();
});

Promise.all([
  document.fonts.load('400 60px "Familjen Grotesk"'),
  document.fonts.load('500 15px "Familjen Grotesk"'),
  document.fonts.load('400 11px "Martian Mono"'),
]).finally(() => {
  icon.resize();
  strings.resize();
  Loop.start({ build, cursor: false, fit: '.cover', rest: 0, frame: draw });
});
