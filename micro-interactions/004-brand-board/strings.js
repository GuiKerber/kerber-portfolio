/* ==========================================================================
   004 · The strings
   The site's thin "laser" lines (js/lines.js): they cross the whole page,
   bend toward the pointer and glow orange when touched, then spring back;
   now and then a bright comet runs along one. Each line keeps its bend and
   glow in plain numbers, so the loop can tween them and draw any frame.
   ========================================================================== */
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const LINES = [
  // [x0, y0, x1, y1] in stage fractions; ends sit off-screen
  [-0.1, 0.18, 1.1, 0.62],
  [-0.1, 0.86, 1.1, 0.08],
  [0.22, -0.1, 0.64, 1.1],
  [0.92, -0.1, 0.48, 1.1],
  [-0.1, 0.42, 1.1, 0.98],
];

export function createStrings(canvas, points = LINES) {
  const ctx = canvas.getContext('2d');
  const color = {
    line: token('--color-string'),
    active: token('--color-string-active'),
    comet: token('--color-comet'),
  };
  let w = 0;
  let h = 0;

  // bend: offset of the curve's middle, in pixels; glow: 0..1
  const lines = points.map((p) => ({ p, bend: { x: 0, y: 0, vx: 0, vy: 0 }, glow: 0, grabbed: false }));
  // t runs 0 -> 1.15 along the line; the tail trails behind
  const comets = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ends(l) {
    const [x0, y0, x1, y1] = l.p;
    return { ax: x0 * w, ay: y0 * h, bx: x1 * w, by: y1 * h };
  }

  // Where a point sits against a line: how far along, and its offset from it
  function project(l, x, y) {
    const { ax, ay, bx, by } = ends(l);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const px = ax + dx * t;
    const py = ay + dy * t;
    return { t, ox: x - px, oy: y - py, dist: Math.hypot(x - px, y - py) };
  }

  // Where the midpoint of a line is, and which way is "across" it
  function middle(l) {
    const { ax, ay, bx, by } = ends(l);
    const len = Math.hypot(bx - ax, by - ay);
    return { x: (ax + bx) / 2, y: (ay + by) / 2, nx: -(by - ay) / len, ny: (bx - ax) / len };
  }

  function pointOn(l, t) {
    const { ax, ay, bx, by } = ends(l);
    const mx = (ax + bx) / 2 + l.bend.x;
    const my = (ay + by) / 2 + l.bend.y;
    const u = 1 - t;
    return { x: u * u * ax + 2 * u * t * mx + t * t * bx, y: u * u * ay + 2 * u * t * my + t * t * by };
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const stroke = (style, alpha, width) => {
      ctx.strokeStyle = style;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    lines.forEach((l) => {
      const { ax, ay, bx, by } = ends(l);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2 + l.bend.x, (ay + by) / 2 + l.bend.y, bx, by);
      stroke(color.line, 0.07 + l.glow * 0.25, 1);
      if (l.glow > 0.02) stroke(color.active, l.glow * 0.35, 2);
    });
    comets.forEach((c) => {
      if (c.t <= 0 || c.t >= 1.15) return;
      const steps = 14;
      const tail = 0.12;
      for (let s = 0; s < steps; s++) {
        const t0 = c.t - tail * (s / steps);
        const t1 = c.t - tail * ((s + 1) / steps);
        if (t1 < 0 || t0 > 1) continue;
        const p0 = pointOn(lines[c.line], Math.min(1, t0));
        const p1 = pointOn(lines[c.line], Math.max(0, t1));
        const k = 1 - s / steps;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        if (s < 3) stroke(color.comet, k, 1 + k);
        else stroke(color.active, k * 0.8, 1 + k);
      }
    });
    ctx.globalAlpha = 1;
  }

  /* Live only: the pointer grabs a line it comes close to and lets go with a
     springy wobble, as on the site. `pointer` is null when it's away. */
  function step(dt, pointer) {
    lines.forEach((l) => {
      if (pointer) {
        const { ox, oy, dist } = project(l, pointer.x, pointer.y);
        if (dist < 48) l.grabbed = true;
        if (l.grabbed && dist > 140) l.grabbed = false;
        if (l.grabbed) {
          l.bend.vx += (ox * 1.6 - l.bend.x) * 0.25;
          l.bend.vy += (oy * 1.6 - l.bend.y) * 0.25;
          l.glow = Math.min(1, l.glow + 0.12);
        }
      } else {
        l.grabbed = false;
      }
      if (!l.grabbed) {
        l.bend.vx += -l.bend.x * 0.08;
        l.bend.vy += -l.bend.y * 0.08;
      }
      l.bend.vx *= 0.82;
      l.bend.vy *= 0.82;
      l.bend.x += l.bend.vx;
      l.bend.y += l.bend.vy;
      l.glow = Math.max(0, l.glow - dt * 0.8);
    });
    for (let i = comets.length - 1; i >= 0; i--) {
      comets[i].t += dt * comets[i].speed;
      if (comets[i].t > 1.15) comets.splice(i, 1);
    }
  }

  // Rest: straight, dark, no comets
  function reset() {
    lines.forEach((l) => {
      Object.assign(l.bend, { x: 0, y: 0, vx: 0, vy: 0 });
      l.glow = 0;
      l.grabbed = false;
    });
    comets.length = 0;
  }

  resize();
  return { lines, comets, resize, draw, step, reset, middle, project };
}
