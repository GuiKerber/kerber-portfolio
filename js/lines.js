// Thin "laser" lines across the hero. They bend toward the cursor when touched
// and spring back; a bright comet travels along them from time to time.
import { token } from './tokens.js';

const LINES = [
  // [x0, y0, x1, y1] in viewport fractions; endpoints sit off-screen
  [-0.1, 0.18, 1.1, 0.62],
  [-0.1, 0.86, 1.1, 0.08],
  [0.22, -0.1, 0.64, 1.1],
  [0.92, -0.1, 0.48, 1.1],
  [-0.1, 0.42, 1.1, 0.98],
  [-0.1, 0.05, 0.78, 1.1],
  [1.1, 0.3, 0.05, 1.1],
];

export function createLines(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const color = {
    line: token('--color-string'),
    active: token('--color-string-active'),
    comet: token('--color-comet'),
  };
  let w = 0, h = 0, dpr = 1;
  const mouse = { x: -9999, y: -9999, active: false };
  let opacity = 1;
  let running = true;

  const lines = LINES.map((p) => ({
    p,
    bend: { x: 0, y: 0, vx: 0, vy: 0 },
    glow: 0,
    grabbed: false,
  }));

  const comets = [];
  let nextComet = 1.2;

  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2);
    // works both for the full-screen hero canvas and for one inside a section
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let inView = true;
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) resize();
  }).observe(canvas);

  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.active = false; });

  function endpoints(l) {
    const [x0, y0, x1, y1] = l.p;
    return { ax: x0 * w, ay: y0 * h, bx: x1 * w, by: y1 * h };
  }

  // Distance from the cursor to the (straight) line and the perpendicular offset
  function project(l) {
    const { ax, ay, bx, by } = endpoints(l);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((mouse.x - ax) * dx + (mouse.y - ay) * dy) / len2));
    const px = ax + dx * t, py = ay + dy * t;
    return { t, ox: mouse.x - px, oy: mouse.y - py, dist: Math.hypot(mouse.x - px, mouse.y - py) };
  }

  function pointOn(l, t) {
    const { ax, ay, bx, by } = endpoints(l);
    const mx = (ax + bx) / 2 + l.bend.x, my = (ay + by) / 2 + l.bend.y;
    const u = 1 - t;
    return {
      x: u * u * ax + 2 * u * t * mx + t * t * bx,
      y: u * u * ay + 2 * u * t * my + t * t * by,
    };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!running || !inView) { requestAnimationFrame(frame); return; }

    ctx.clearRect(0, 0, w, h);
    // every stroke sets its own alpha on top of the layer opacity
    const stroke = (style, alpha, width) => {
      ctx.strokeStyle = style;
      ctx.globalAlpha = opacity * alpha;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    lines.forEach((l) => {
      if (!reducedMotion && mouse.active) {
        const { ox, oy, dist } = project(l);
        if (dist < 48 && !l.grabbed) l.grabbed = true;
        if (l.grabbed && dist > 140) l.grabbed = false;
        if (l.grabbed) {
          // follow the cursor (a bit more than 1:1 at the midpoint of a quadratic)
          l.bend.vx += (ox * 1.6 - l.bend.x) * 0.25;
          l.bend.vy += (oy * 1.6 - l.bend.y) * 0.25;
          l.glow = Math.min(1, l.glow + 0.12);
        }
      } else {
        l.grabbed = false;
      }
      if (!l.grabbed) {
        // spring back with a little wobble
        l.bend.vx += -l.bend.x * 0.08;
        l.bend.vy += -l.bend.y * 0.08;
      }
      l.bend.vx *= 0.82; l.bend.vy *= 0.82;
      l.bend.x += l.bend.vx; l.bend.y += l.bend.vy;
      l.glow = Math.max(0, l.glow - dt * 0.8);

      const { ax, ay, bx, by } = endpoints(l);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2 + l.bend.x, (ay + by) / 2 + l.bend.y, bx, by);
      stroke(color.line, 0.07 + l.glow * 0.25, 1);
      if (l.glow > 0.02) stroke(color.active, l.glow * 0.35, 2);
    });

    // Comets
    if (!reducedMotion) {
      nextComet -= dt;
      if (nextComet <= 0) {
        comets.push({ line: lines[Math.floor(Math.random() * lines.length)], t: 0, speed: 0.35 + Math.random() * 0.35 });
        nextComet = 1.4 + Math.random() * 2.2;
      }
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.t += dt * c.speed;
        if (c.t > 1.15) { comets.splice(i, 1); continue; }
        const steps = 14;
        const tail = 0.12;
        for (let s = 0; s < steps; s++) {
          const t0 = c.t - tail * (s / steps);
          const t1 = c.t - tail * ((s + 1) / steps);
          if (t1 < 0 || t0 > 1) continue;
          const p0 = pointOn(c.line, Math.min(1, t0));
          const p1 = pointOn(c.line, Math.max(0, t1));
          const k = 1 - s / steps;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          if (s < 3) stroke(color.comet, k, 1 + k);
          else stroke(color.active, k * 0.8, 1 + k);
        }
      }
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setOpacity(o) {
      opacity = o;
      running = o > 0.01;
      if (!running) ctx.clearRect(0, 0, w, h);
    },
  };
}
