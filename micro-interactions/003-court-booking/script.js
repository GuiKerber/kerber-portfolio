/* ==========================================================================
   003 · Court booking
   Pick a sport and the court above flips over to it while the whole page
   changes colour; pick a time and book it. The times and who has taken them
   are illustrative.
   ========================================================================== */
import { SPORTS, courts } from './courts.js';

const token = Loop.token;
const stage = document.querySelector('.stage');
const form = stage.querySelector('.booking');
const court = form.querySelector('.court');
const tile = court.querySelector('.court__tile');
const faces = {};
for (const sport of SPORTS) {
  faces[sport] = court.querySelector(`[data-sport="${sport}"]`);
  faces[sport].innerHTML = courts[sport]();
}
const thumb = form.querySelector('.sports__thumb');
const pills = Object.fromEntries(SPORTS.map((s) => [s, form.querySelector(`input[value="${s}"]`).closest('.pill')]));
const sportInputs = [...form.querySelectorAll('input[name="sport"]')];
const dayName = form.querySelector('.day__name');
const daySteps = [...form.querySelectorAll('.day__step')];
const slotsBox = form.querySelector('.slots');
const slots = [...form.querySelectorAll('.slot')];
const chips = slots.map((s) => s.querySelector('.slot__chip'));
const checks = slots.map((s) => s.querySelector('.slot__check'));
const emptyWhen = form.querySelector('.slots__when');
const cta = form.querySelector('.cta');
const ctaLabel = Object.fromEntries([...cta.querySelectorAll('[data-cta]')].map((el) => [el.dataset.cta, el]));
const ctaTimes = [...cta.querySelectorAll('.cta__time')];
const spinner = cta.querySelector('.spinner');
const status = form.querySelector('.status');
const statusMsg = Object.fromEntries([...status.querySelectorAll('[data-status]')].map((el) => [el.dataset.status, el]));

/* Times, and which are taken: per sport, for today and the next two days.
   The third day is fully booked everywhere, to show the empty state. */
const TIMES = slots.map((s) => s.querySelector('input').value);
const ALL = TIMES.map((_, i) => i);
const TAKEN = {
  tennis: [[1, 3], [0], ALL],
  padel: [[0, 2], [3, 5], ALL],
  beach: [[1, 2, 5], [0, 1], ALL],
};

/* ---------- The rally ---------- */
/* The ball flies back and forth between the two rackets, its shadow sliding
   along the ground underneath and shrinking as the ball climbs. The arc is
   sampled into keyframes, so the timeline itself places the ball and the
   recorder gets the right spot at any frame. Each player swings as the ball
   reaches their racket. */
const LEG = 0.8;     // one crossing
const STEPS = 16;
const SWING = 38;    // degrees the arm winds back, and follows through
const xy = (value) => value.split(' ').map(Number);
const height = (k) => 4 * k * (1 - k); // 0 at either racket, 1 at the top

const rallies = SPORTS.map((sport) => {
  const ball = faces[sport].querySelector('.court__ball');
  const shadow = faces[sport].querySelector('.court__ball-shadow');
  const [ax, ay] = xy(ball.dataset.from);
  const [bx, by] = xy(ball.dataset.to);
  const [sx, sy] = xy(shadow.dataset.from);
  const [tx, ty] = xy(shadow.dataset.to);
  const peak = Number(ball.dataset.peak);
  const steps = Array.from({ length: STEPS }, (_, i) => (i + 1) / STEPS);
  return {
    ball,
    shadow,
    arms: [...faces[sport].querySelectorAll('.court__swing')], // the far player, then the near one
    flight: { x: steps.map((k) => (bx - ax) * k), y: steps.map((k) => (by - ay) * k - peak * height(k)), easeEach: 'none' },
    trail: { x: steps.map((k) => (tx - sx) * k), y: steps.map((k) => (ty - sy) * k), scale: steps.map((k) => 1 - 0.45 * height(k)), easeEach: 'none' },
  };
});

// Wind up, swing through the ball at `hit`, and recover; parts outside the rally are left out
function swing(tl, arm, hit, end) {
  const part = (t0, t1, from, to, ease) => {
    if (t0 < -0.001 || t1 > end + 0.001) return;
    tl.fromTo(arm, { rotation: from, svgOrigin: '0 0' }, { rotation: to, svgOrigin: '0 0', duration: t1 - t0, ease, immediateRender: false }, t0);
  };
  part(hit - 0.32, hit - 0.12, 0, SWING, 'power2.out');
  part(hit - 0.12, hit, SWING, 0, 'sine.in');
  part(hit, hit + 0.12, 0, -SWING, 'sine.out');
  part(hit + 0.12, hit + 0.45, -SWING, 0, 'power2.inOut');
}

// `end` seconds of rally on every court, an even number of crossings long,
// starting with the ball on the far player's racket
function rally(tl, end) {
  const legs = Math.round(end / LEG);
  for (const { ball, shadow, arms, flight, trail } of rallies) {
    tl.fromTo(ball, { x: 0, y: 0 }, { keyframes: flight, duration: LEG, ease: 'none', repeat: legs - 1, yoyo: true }, 0)
      .fromTo(shadow, { x: 0, y: 0, scale: 1, transformOrigin: '50% 50%' }, { keyframes: trail, duration: LEG, ease: 'none', repeat: legs - 1, yoyo: true }, 0);
    for (let i = 0; i <= legs; i++) swing(tl, arms[i % 2], i * LEG, end);
  }
  return tl;
}

/* ---------- Page colour ---------- */
/* Blending two page colours channel by channel passes through a muddy
   brown. The browser blends them in OKLCH instead, which keeps brightness
   even and turns the hue the short way round; the loop steps through a few
   of those blends. */
const blend = (() => {
  const supported = CSS.supports('color', 'color-mix(in oklch, red, blue)');
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  return (a, b, share) => {
    if (!supported) return b;
    probe.fillStyle = `color-mix(in oklch, ${a}, ${b} ${share}%)`;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, bl] = probe.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${bl})`;
  };
})();

function pageColor(from, to) {
  const a = token(`--cb-bg-${from}`);
  const b = token(`--cb-bg-${to}`);
  return [25, 50, 75].map((share) => blend(a, b, share)).concat(b);
}

/* ---------- Motion pieces, shared by the loop and by live clicks ---------- */
/* An instant change written as a tween too short to see. GSAP undoes plain
   set() calls last when the visitor takes over, so a later set() would leave
   its "before" state on screen; a timed tween is undone in time order. */
const snap = (tl, target, vars, at) => tl.to(target, { ...vars, duration: 0.001, ease: 'none' }, at);

/* The court is a two-sided tile. The new sport goes on its back, the tile
   turns over its long diagonal (near edge up, over the top, down at the
   back), lifting a little on the way, and settles with the new court facing
   you. Then it quietly resets to its front with the new court there, which
   looks exactly the same. */
const FLIP = 0.85;

function flip(tl, at, from, to) {
  snap(tl, faces[to], { '--side': '180deg', autoAlpha: 1 }, at);
  tl.fromTo(tile, { '--flip': '0deg' }, { '--flip': '180deg', duration: FLIP, ease: 'power2.inOut', immediateRender: false }, at)
    .to(tile, { keyframes: { '--lift': [1.08, 1], easeEach: 'sine.inOut' }, duration: FLIP }, at);
  snap(tl, tile, { '--flip': '0deg' }, at + FLIP);
  snap(tl, faces[to], { '--side': '0deg' }, at + FLIP);
  snap(tl, faces[from], { autoAlpha: 0 }, at + FLIP);
  // The page colour token itself, so the stage and the document behind it change together
  tl.to(document.documentElement, { keyframes: { '--stage-bg': pageColor(from, to), easeEach: 'none' }, duration: 0.6, ease: 'power2.inOut' }, at + 0.1)
    .to(thumb, { xPercent: 100 * SPORTS.indexOf(to), duration: 0.3, ease: 'power3.inOut' }, at);
}

// The times fade out, change to the new sport's, and come back one by one
function swapTimes(tl, at, apply) {
  tl.to(chips, { autoAlpha: 0, duration: 0.12, ease: 'power1.in' }, at);
  apply(tl, at + 0.12);
  tl.fromTo(chips, { autoAlpha: 0, y: 6 },
    { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', stagger: 0.035, immediateRender: false }, at + 0.14);
}

function showCta(tl, at, from, to) {
  tl.to(ctaLabel[from], { autoAlpha: 0, duration: 0.12 }, at)
    .fromTo(ctaLabel[to], { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out', immediateRender: false }, at + 0.08);
}

/* ---------- The loop ---------- */
function restPoint() {
  const s = stage.getBoundingClientRect();
  const p = form.querySelector('.panel').getBoundingClientRect();
  return { x: Math.min(p.right - s.left + 36, s.width - 28), y: p.top - s.top + p.height * 0.55 };
}

const END = 12.8; // a whole number of crossings, so the ball is home again

function build(tl, cursor) {
  const rest = restPoint();
  const PADEL = 1.5;   // padel takes the click
  const PICK = 3.35;   // 19:00 is chosen
  const BOOK = 4.7;    // the booking goes in
  const BEACH = 7.6;   // beach tennis
  const TENNIS = 10.3; // and back to where it started
  const SLOT = TIMES.indexOf('19:00');

  rally(tl, END);
  cursor.set(rest, 0);

  // Hover a sport, press it, and the court flips while the page recolours
  const pickSport = (time, from, to) => {
    cursor.move(pills[to], time - 1, { duration: 0.85 });
    tl.to(pills[to], { backgroundColor: token('--cb-pill-hover'), duration: 0.15 }, time - 0.25);
    cursor.press(time - 0.08);
    tl.to(pills[to], { backgroundColor: token('--cb-pill-hover-clear'), duration: 0.15 }, time)
      .to(pills[from], { color: token('--cb-text'), duration: 0.2 }, time)
      .to(pills[to], { color: token('--cb-on-selected'), duration: 0.2 }, time);
    flip(tl, time, from, to);
    swapTimes(tl, time, (t, when) => {
      slots.forEach((slot, i) => snap(t, slot, { attr: { 'data-state': TAKEN[to][0].includes(i) ? 'taken' : 'open' } }, when));
    });
  };

  // 1. Padel
  pickSport(PADEL, 'tennis', 'padel');

  // 2. 19:00, and the button wakes up
  cursor.move(chips[SLOT], PICK - 0.85, { duration: 0.8 });
  tl.to(chips[SLOT], { backgroundColor: token('--cb-surface-hover'), duration: 0.15 }, PICK - 0.25);
  cursor.press(PICK - 0.08);
  tl.to(chips[SLOT], { backgroundColor: token('--cb-selected'), color: token('--cb-on-selected'), duration: 0.2 }, PICK)
    .fromTo(checks[SLOT], { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'back.out(2)', immediateRender: false }, PICK + 0.05)
    .to(cta, { backgroundColor: token('--cb-cta'), color: token('--cb-on-cta'), duration: 0.2 }, PICK);
  showCta(tl, PICK, 'idle', 'ready');

  // 3. Book: a short wait, then it's yours
  cursor.move(cta, BOOK - 0.8, { duration: 0.75, oy: 0.6 });
  tl.to(cta, { backgroundColor: token('--cb-cta-hover'), duration: 0.15 }, BOOK - 0.25);
  cursor.press(BOOK - 0.08);
  tl.to(cta, { scale: 0.97, duration: 0.1, ease: 'power2.out' }, BOOK - 0.08)
    .to(cta, { scale: 1, duration: 0.3, ease: 'back.out(2)' }, BOOK + 0.02)
    .to(cta, { backgroundColor: token('--cb-cta'), duration: 0.2 }, BOOK + 0.1);
  showCta(tl, BOOK, 'ready', 'loading');
  tl.fromTo(spinner, { rotation: 0 }, { rotation: 360 * 1.5, duration: 1, ease: 'none', immediateRender: false }, BOOK);
  showCta(tl, BOOK + 1, 'loading', 'done');
  tl.fromTo(statusMsg.done, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', immediateRender: false }, BOOK + 1.1);
  cursor.move(rest, BOOK + 0.4, { duration: 0.9 });

  // 4. Beach tennis: a new court, so the booking clears
  pickSport(BEACH, 'padel', 'beach');
  tl.to(statusMsg.done, { autoAlpha: 0, duration: 0.15 }, BEACH)
    .to(cta, { backgroundColor: token('--cb-cta-off'), color: token('--cb-on-cta-off'), duration: 0.2 }, BEACH);
  snap(tl, chips[SLOT], { backgroundColor: token('--cb-surface'), color: token('--cb-text') }, BEACH + 0.12);
  snap(tl, checks[SLOT], { autoAlpha: 0 }, BEACH + 0.12);
  showCta(tl, BEACH, 'done', 'idle');

  // 5. Back to tennis, where the loop began
  pickSport(TENNIS, 'beach', 'tennis');
  cursor.move(rest, TENNIS + 0.45, { duration: 0.95 });
  tl.set({}, {}, END);
}

/* ---------- Live: the visitor books for real (in this page) ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DAYS = 3;
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

function dayLabel(day) {
  if (day === 0) return { name: 'Today', when: 'today' };
  if (day === 1) return { name: 'Tomorrow', when: 'tomorrow' };
  const date = new Date();
  date.setDate(date.getDate() + day);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return { name: weekday, when: `on ${weekday}` };
}

// Lay out the times for the current sport and day; nothing chosen yet
function renderTimes() {
  const taken = TAKEN[live.sport][live.day];
  slots.forEach((slot, i) => {
    const input = slot.querySelector('input');
    slot.dataset.state = taken.includes(i) ? 'taken' : 'open';
    input.disabled = taken.includes(i);
    input.checked = false;
  });
  const label = dayLabel(live.day);
  dayName.textContent = label.name;
  emptyWhen.textContent = label.when;
  if (taken.length === TIMES.length) slotsBox.dataset.empty = '';
  else delete slotsBox.dataset.empty;
  daySteps[0].disabled = live.day === 0;
  daySteps[1].disabled = live.day === DAYS - 1;
}

function setCta(state, time) {
  cta.dataset.state = state;
  cta.disabled = state === 'idle';
  cta.setAttribute('aria-disabled', String(state !== 'ready'));
  if (time) ctaTimes.forEach((el) => { el.textContent = time; });
}

function setStatus(state) {
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
}

function clearChoice() {
  live.slot = null;
  setCta('idle');
  setStatus(null);
}

function startLive() {
  live = { sport: 'tennis', day: 0, slot: null, busy: false, ctx: gsap.context(() => {}, stage) };
  if (!reduce) live.ctx.add(() => rally(gsap.timeline({ repeat: -1 }), LEG * 2));
}

// Back to how the loop starts: tennis, today, nothing chosen
function stopLive() {
  if (live) live.ctx.revert();
  form.reset();
  live = { sport: 'tennis', day: 0 };
  renderTimes();
  setCta('idle', '19:00');
  setStatus(null);
  live = null;
}

sportInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (!live) return;
    const from = live.sport;
    const to = input.value;
    live.sport = to;
    clearChoice();
    // A quick second pick lands the tile from the first one before turning again
    if (live.flip) live.flip.progress(1);
    live.flip = play((tl) => {
      flip(tl, 0, from, to);
      swapTimes(tl, 0, (t, when) => t.call(renderTimes, null, when));
    });
  });
});

daySteps.forEach((button) => {
  button.addEventListener('click', (e) => {
    if (!live) return;
    live.day = Math.min(DAYS - 1, Math.max(0, live.day + Number(button.dataset.step)));
    clearChoice();
    daySteps[0].disabled = live.day === 0;
    daySteps[1].disabled = live.day === DAYS - 1;
    // At either end the button switches off; keyboard focus moves to the other one
    if (button.disabled && e.detail === 0) daySteps.find((b) => b !== button).focus();
    play((tl) => swapTimes(tl, 0, (t, when) => t.call(renderTimes, null, when)));
  });
});

slots.forEach((slot) => {
  slot.querySelector('input').addEventListener('change', (e) => {
    if (!live) return;
    live.slot = e.target.value;
    setStatus(null);
    setCta('ready', live.slot);
  });
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!live || !live.slot || live.busy) return;
  if (!navigator.onLine) {
    setStatus('error');
    return;
  }
  live.busy = true;
  setStatus(null);
  setCta('loading');
  setTimeout(() => {
    if (!live) return;
    live.busy = false;
    setCta('done');
    setStatus('done');
  }, reduce ? 300 : 1000);
});

addEventListener('online', () => { if (status.dataset.state === 'error') setStatus(null); });

/* ---------- Start ---------- */
Promise.all([
  document.fonts.load('800 38px "Bricolage Grotesque"'),
  document.fonts.load('700 15px "Inter Tight"'),
  document.fonts.load('600 15px "Inter Tight"'),
]).finally(() => {
  Loop.start({ build, fit: '.booking', rest: 3.6, live: startLive, reset: stopLive });
});
