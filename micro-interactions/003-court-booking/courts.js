/* ==========================================================================
   003 · Court illustrations
   Flat isometric courts drawn in code, after the style of a printed sports
   map: thick ink outlines, flat fills, a floating slab with a hard shadow.
   One builder per sport, each returning an <svg> string. Every colour is a
   CSS token (--cb-*), so a court can be retuned to stand out from the page.
   ========================================================================== */

const U = 16;                          // pixels per world unit
const COS = Math.cos(Math.PI / 6);     // true isometric: axes 30° off horizontal
const VIEW = { w: 420, h: 330 };
const ORIGIN = { x: 245, y: 73 };      // where world (0, 0, 0) lands in the view

/* World axes: x runs down to the right, y down to the left, z straight up.
   Courts lie along y, so their nets run along x. */
const P = (x, y, z = 0) => [ORIGIN.x + (x - y) * COS * U, ORIGIN.y + (x + y) * 0.5 * U - z * U];

/* ---------- Drawing primitives ---------- */
const f = (n) => Math.round(n * 10) / 10;
const paint = (name) => (name === 'none' ? 'none' : `var(--cb-${name})`);

// fill, stroke (an ink outline by default) and stroke width
const st = (fill, stroke = 'ink', width = 2) =>
  `fill:${paint(fill)};stroke:${paint(stroke)};stroke-width:${width};stroke-linejoin:round;stroke-linecap:round`;

const poly = (points, style) => `<polygon points="${points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" style="${style}"/>`;
const seg = ([x1, y1], [x2, y2], style) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" style="${style}"/>`;
const stroke = (color, width) => `stroke:${paint(color)};stroke-width:${width};stroke-linecap:round;fill:none`;

// An outlined tube between two points: ink underneath, colour on top
const tube = (a, b, color, width = 3) => seg(a, b, stroke('ink', width + 2.4)) + seg(a, b, stroke(color, width));

// A flat rectangle lying on the ground (or at height z)
const flat = (x0, y0, x1, y1, z = 0) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];

// A rounded rectangle on the ground, as points around its edge
function roundRect(x0, y0, w, d, r, z) {
  const out = [];
  const corners = [[x0 + w - r, y0 + r, -90], [x0 + w - r, y0 + d - r, 0], [x0 + r, y0 + d - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 8; i++) {
      const a = ((start + (i * 90) / 8) * Math.PI) / 180;
      out.push(P(cx + r * Math.cos(a), cy + r * Math.sin(a), z));
    }
  }
  return out;
}

// The outline around a set of points, used for the slab's sides
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.reverse())];
}

// A box: its top and the two faces turned to the viewer
function box(x, y, z, w, d, h, { top, right, left }, width = 1.6) {
  return poly(flat(x, y, x + w, y + d, z + h), st(top, 'ink', width))
    + poly([P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)], st(right, 'ink', width))
    + poly([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)], st(left, 'ink', width));
}

// A hard shadow pressed flat on the ground, nudged toward the viewer
const groundShadow = (x0, y0, x1, y1, nudge = 0.25) => poly(flat(x0 + nudge, y0 + nudge, x1 + nudge, y1 + nudge, 0), st('ink', 'none'));

// An upright cylinder (bins, bottles, ball tubes)
function cylinder(x, y, r, h, fill, z = 0) {
  const [cx, top] = P(x, y, z + h);
  const bottom = P(x, y, z)[1];
  const rx = f(1.2247 * r * U);
  const ry = f(0.7071 * r * U);
  return `<path d="M${f(cx - rx)} ${f(top)}V${f(bottom)}A${rx} ${ry} 0 0 0 ${f(cx + rx)} ${f(bottom)}V${f(top)}Z" style="${st(fill, 'ink', 1.5)}"/>`
    + `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${rx}" ry="${ry}" style="${st(fill, 'ink', 1.5)}"/>`;
}

/* Patterns that lie in an upright wall: one along x, one along y.
   Pattern space is world units, mapped onto the wall by its two axes. */
function wallPatterns(id) {
  const along = {
    x: [COS * U, 0.5 * U, 0, -U, ORIGIN.x, ORIGIN.y],
    y: [-COS * U, 0.5 * U, 0, -U, ORIGIN.x, ORIGIN.y],
  };
  let out = '';
  for (const [axis, m] of Object.entries(along)) {
    const matrix = m.map(f).join(' ');
    // Chain-link: a diamond mesh
    out += `<pattern id="${id}-mesh-${axis}" patternUnits="userSpaceOnUse" width="0.3" height="0.3" patternTransform="matrix(${matrix})">`
      + `<path d="M-0.05 -0.05L0.35 0.35M0.35 -0.05L-0.05 0.35" style="stroke:var(--cb-mesh);stroke-width:0.035;fill:none"/></pattern>`;
    // Net: a square weave
    out += `<pattern id="${id}-net-${axis}" patternUnits="userSpaceOnUse" width="0.16" height="0.16" patternTransform="matrix(${matrix})">`
      + `<path d="M0 0H0.16M0 0V0.16" style="stroke:var(--cb-ink);stroke-width:0.03;fill:none"/></pattern>`;
  }
  return out;
}

// A wall section standing on the line from a to b, between heights z0 and z1
const wall = (a, b, z0, z1) => [P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)];
const axisOf = (a, b) => (a[1] === b[1] ? 'x' : 'y');

/* A chain-link fence along a straight line: posts, mesh and a top rail */
function fence(id, a, b, { height = 3, posts = 4, post = 'post' } = {}) {
  const axis = axisOf(a, b);
  let out = poly(wall(a, b, 0, height), `fill:url(#${id}-mesh-${axis});stroke:none`);
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    out += tube(P(x, y, 0), P(x, y, height), post, 2.6);
  }
  out += tube(P(a[0], a[1], height), P(b[0], b[1], height), post, 2.2);
  return out;
}

/* The slab every court sits on, floating over its own hard shadow */
function slab({ w, d, r = 1.25, t = 0.8, drop = 2.4, tone }) {
  const top = roundRect(0, 0, w, d, r, 0);
  const band = roundRect(0, 0, w, d, r, -t * 0.42);
  const bottom = roundRect(0, 0, w, d, r, -t);
  const shadow = roundRect(0.2, 0.2, w, d, r, -t - drop);
  return poly(shadow, st('ink', 'none'))
    + poly(hull([...top, ...bottom]), st(`${tone}-side`, 'ink', 2.2))
    + poly(hull([...top, ...band]), st(`${tone}-band`, 'ink', 1.4))
    + poly(top, st(`${tone}-top`, 'ink', 2.2));
}

/* A net across the court at y, between two posts */
function net(id, y, x0, x1, { low = 0, high = 0.75, post = 'post', tape = 'line' } = {}) {
  return poly(wall([x0, y], [x1, y], low, high), `fill:url(#${id}-net-x);stroke:var(--cb-ink);stroke-width:1.2`)
    + tube(P(x0, y, high), P(x1, y, high), tape, 2.4)
    + (low > 0 ? tube(P(x0, y, low), P(x1, y, low), tape, 1.4) : '')
    + tube(P(x0, y, 0), P(x0, y, high + 0.12), post, 2.8)
    + tube(P(x1, y, 0), P(x1, y, high + 0.12), post, 2.8);
}

/* ---------- People ---------- */
/* A player, standing at a spot on the ground. Drawn upright, facing the
   viewer, in its own pixels. `hit` is where the racket meets the ball and
   `foot` the spot on the ground. The racket arm sits in .court__swing, whose
   origin is the shoulder, so the loop can swing it. */
const RACKET = { x: 17, y: -28.5 };
const SHOULDER = { x: 4.8, y: -24 };

function player(x, y, { look, racket, flip = false }) {
  const [px, py] = P(x, y);
  const s = flip ? -1 : 1;
  const limb = (d, color = `${look}-skin`) => `<path d="${d}" style="${stroke('ink', 4.4)};stroke-linejoin:round"/><path d="${d}" style="${stroke(color, 2.4)};stroke-linejoin:round"/>`;
  const face = racket === 'strings'
    ? `<ellipse cx="${RACKET.x}" cy="${RACKET.y}" rx="3.6" ry="5" transform="rotate(40 ${RACKET.x} ${RACKET.y})" style="${st('line', 'ink', 1.4)}"/>`
      + `<path d="M14.6 -28.8L19.4 -28.2M16.4 -31.6L17.6 -25.4" style="${stroke('ink', 0.6)}"/>`
    : `<ellipse cx="${RACKET.x}" cy="${RACKET.y}" rx="3.8" ry="4.8" transform="rotate(40 ${RACKET.x} ${RACKET.y})" style="${st(`${look}-racket`, 'ink', 1.4)}"/>`
      + `<circle cx="16.4" cy="-29.4" r="0.6" style="fill:var(--cb-ink)"/><circle cx="18" cy="-27.8" r="0.6" style="fill:var(--cb-ink)"/>`;
  const hair = look === 'a'
    ? `<path d="M-4.1 -30.4C-4.4 -35.6 5 -35.8 4.6 -30.6C2.4 -32.4 -1.2 -32.4 -4.1 -30.4Z" style="${st('a-hair', 'ink', 1.2)}"/>`
      + `<path d="M-3.6 -31.6C-7.6 -31.8 -8.4 -27.4 -6.6 -24.8C-6.4 -27.8 -5.2 -29 -3.6 -29.2Z" style="${st('a-hair', 'ink', 1.2)}"/>`
    : `<path d="M-4.2 -30.2C-4.4 -35.8 5 -36 4.6 -30.2Z" style="${st('b-cap', 'ink', 1.2)}"/>`
      + `<path d="M3.2 -30.8L8.6 -30L4.4 -29.2Z" style="${st('b-cap', 'ink', 1.2)}"/>`;
  const lower = look === 'a'
    ? `<path d="M-4.8 -16.4H4.8L6.6 -10.6H-6.6Z" style="${st('a-skirt', 'ink', 1.3)}"/>`
    : `<path d="M-5 -16.4H5L5.8 -10.2H0.9L0 -12.6L-0.9 -10.2H-5.8Z" style="${st('b-shorts', 'ink', 1.3)}"/>`;

  const svg = `<g transform="translate(${f(px)} ${f(py)}) scale(${s} 1)">`
    + `<ellipse cx="1" cy="0.4" rx="7.4" ry="2.4" style="fill:var(--cb-ink)"/>`
    + limb('M-2.6 -11.5L-3.6 -2')
    + limb('M2.6 -11.5L4 -2.2')
    + `<ellipse cx="-3.8" cy="-1.5" rx="2.7" ry="1.6" style="${st('line', 'ink', 1.2)}"/>`
    + `<ellipse cx="4.3" cy="-1.6" rx="2.7" ry="1.6" style="${st('line', 'ink', 1.2)}"/>`
    + lower
    + limb('M-4.8 -24L-8 -18.6L-6.2 -15.4')
    + `<path d="M-5.2 -25.6C-2 -27.2 2 -27.2 5.2 -25.6L5.8 -15.6H-5.8Z" style="${st(`${look}-shirt`, 'ink', 1.3)}"/>`
    + `<g transform="translate(${SHOULDER.x} ${SHOULDER.y})"><g class="court__swing"><g transform="translate(${-SHOULDER.x} ${-SHOULDER.y})">`
    + `<path d="M12.2 -22.2L14.6 -25" style="${stroke('ink', 2)}"/>`
    + face
    + limb('M4.8 -24L9.6 -20.4L12.4 -22.2')
    + '</g></g></g>'
    + `<circle cx="0.4" cy="-30" r="4" style="${st(`${look}-skin`, 'ink', 1.3)}"/>`
    + hair
    + '</g>';
  return { svg, hit: [px + s * RACKET.x, py + RACKET.y], foot: [px, py] };
}

/* The ball flies from one racket to the other; the loop works out its arc
   from the ends and the peak written on it. Its shadow runs along the
   ground underneath, from below one racket to below the other. */
const pair = ([x, y]) => `${f(x)} ${f(y)}`;

function ballShadow(a, b) {
  const from = [a.hit[0], a.foot[1]];
  const to = [b.hit[0], b.foot[1]];
  return `<ellipse class="court__ball-shadow" cx="${f(from[0])}" cy="${f(from[1])}" rx="3.4" ry="1.7" data-from="${pair(from)}" data-to="${pair(to)}" style="fill:var(--cb-ink)"/>`;
}

function ball(a, b, peak) {
  return `<circle class="court__ball" cx="${f(a.hit[0])}" cy="${f(a.hit[1])}" r="2.9" data-from="${pair(a.hit)}" data-to="${pair(b.hit)}" data-peak="${peak}" style="${st('ball', 'ink', 1.3)}"/>`;
}

// A few loose balls lying around
const looseBalls = (spots) => spots.map(([x, y]) => {
  const [px, py] = P(x, y);
  return `<circle cx="${f(px)}" cy="${f(py - 2)}" r="2.3" style="${st('ball', 'ink', 1.1)}"/>`;
}).join('');

/* A bench along the right-hand edge, with a bag on it */
function bench(x, y, len, bag) {
  return groundShadow(x, y, x + 0.7, y + len, 0.3)
    + box(x + 0.08, y + 0.15, 0, 0.12, 0.12, 0.45, { top: 'ink', right: 'ink', left: 'ink' }, 1)
    + box(x + 0.5, y + len - 0.3, 0, 0.12, 0.12, 0.45, { top: 'ink', right: 'ink', left: 'ink' }, 1)
    + box(x, y, 0.45, 0.7, len, 0.16, { top: 'bench-top', right: 'bench-side', left: 'bench-side' })
    + box(x + 0.12, y + len * 0.55, 0.61, 0.45, 0.55, 0.42, { top: `${bag}-top`, right: `${bag}-side`, left: `${bag}-side` }, 1.4);
}

const svgOpen = (id) => `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" xmlns="http://www.w3.org/2000/svg"><defs>${wallPatterns(id)}</defs>`;

/* ---------- Tennis: a hard court on an orange slab, fenced on two sides ---------- */
function tennis() {
  const id = 'tennis';
  const W = 9;
  const D = 14;
  const c = { x0: 2, x1: 7, y0: 1.8, y1: 12.2, net: 7 };
  const line = stroke('line', 2);
  const back = player(5.7, 1.15, { look: 'b', racket: 'strings', flip: true });
  const front = player(3.1, 12.95, { look: 'a', racket: 'strings' });
  const service = 2.85;

  return svgOpen(id)
    + slab({ w: W, d: D, tone: 'tennis' })
    + poly(flat(c.x0, c.y0, c.x1, c.y1), st('tennis-court', 'ink', 1.4))
    + poly(flat(c.x0, c.y0, c.x1, c.y1), line)
    + seg(P(c.x0 + 0.6, c.y0), P(c.x0 + 0.6, c.y1), line)
    + seg(P(c.x1 - 0.6, c.y0), P(c.x1 - 0.6, c.y1), line)
    + seg(P(c.x0 + 0.6, c.net - service), P(c.x1 - 0.6, c.net - service), line)
    + seg(P(c.x0 + 0.6, c.net + service), P(c.x1 - 0.6, c.net + service), line)
    + seg(P(4.5, c.net - service), P(4.5, c.net + service), line)
    + seg(P(4.5, c.y0), P(4.5, c.y0 + 0.25), line)
    + seg(P(4.5, c.y1 - 0.25), P(4.5, c.y1), line)
    + ballShadow(back, front)
    // Fences on the two far sides, with a dark windscreen behind the far baseline
    + fence(id, [0.55, D - 0.6], [0.55, 0.55], { posts: 6 })
    + fence(id, [0.55, 0.55], [W - 0.6, 0.55], { posts: 4 })
    + poly(wall([4.4, 0.55], [8.1, 0.55], 0.15, 2.3), st('tennis-screen', 'ink', 1.6))
    + seg(P(5.63, 0.55, 0.15), P(5.63, 0.55, 2.3), stroke('ink', 1.2))
    + seg(P(6.87, 0.55, 0.15), P(6.87, 0.55, 2.3), stroke('ink', 1.2))
    + seg(P(4.4, 0.55, 1.2), P(8.1, 0.55, 1.2), stroke('line', 1.4))
    + cylinder(1.25, 10.6, 0.42, 0.95, 'bin')
    + looseBalls([[1.1, 6.2], [0.95, 9.3], [7.7, 1.2], [1.4, 12.9]])
    + back.svg
    + net(id, c.net, 1.55, 7.45)
    + cylinder(7.85, 7.6, 0.12, 0.42, 'bottle')
    + front.svg
    + bench(7.75, 8.6, 2.6, 'bag')
    + ball(back, front, 34)
    + '</svg>';
}

/* ---------- Padel: a blue court boxed in by glass and mesh ---------- */
function padel() {
  const id = 'padel';
  const W = 9;
  const D = 14;
  const c = { x0: 2, x1: 7, y0: 2, y1: 12, net: 7 };
  const line = stroke('line', 2);
  const back = player(5.4, 3.1, { look: 'a', racket: 'paddle', flip: true });
  const front = player(3.4, 11.1, { look: 'b', racket: 'paddle' });
  const service = 3.47;
  const glass = (a, b, z0, z1) => poly(wall(a, b, z0, z1), st('glass', 'ink', 1.4))
    + seg(P(a[0] + (b[0] - a[0]) * 0.25, a[1] + (b[1] - a[1]) * 0.25, z1 - 0.3), P(a[0] + (b[0] - a[0]) * 0.4, a[1] + (b[1] - a[1]) * 0.4, z0 + 0.5), stroke('glass-shine', 1.6));
  const glassRow = (a, b, z1, panes) => {
    let out = '';
    for (let i = 0; i < panes; i++) {
      const p0 = [a[0] + ((b[0] - a[0]) * i) / panes, a[1] + ((b[1] - a[1]) * i) / panes];
      const p1 = [a[0] + ((b[0] - a[0]) * (i + 1)) / panes, a[1] + ((b[1] - a[1]) * (i + 1)) / panes];
      out += glass(p0, p1, 0, z1);
    }
    return out;
  };

  return svgOpen(id)
    + slab({ w: W, d: D, tone: 'padel' })
    + poly(flat(c.x0, c.y0, c.x1, c.y1), st('padel-court', 'ink', 1.4))
    + seg(P(c.x0, c.net - service), P(c.x1, c.net - service), line)
    + seg(P(c.x0, c.net + service), P(c.x1, c.net + service), line)
    + seg(P(4.5, c.net - service), P(4.5, c.net + service), line)
    + ballShadow(back, front)
    // The far end: glass to head height with mesh above, then mesh down the far side
    + fence(id, [c.x0, c.y0], [c.x1, c.y0], { height: 3, posts: 3 })
    + glassRow([c.x0, c.y0], [c.x1, c.y0], 2, 3)
    + fence(id, [c.x0, c.y1], [c.x0, c.y0], { height: 2.6, posts: 5 })
    + glassRow([c.x0, c.y1], [c.x0, c.y1 - 2], 2, 1)
    + glassRow([c.x0, c.y0 + 2], [c.x0, c.y0], 2, 1)
    + tube(P(c.x0, c.y0, 0), P(c.x0, c.y0, 3), 'post', 2.8)
    + back.svg
    + net(id, c.net, c.x0, c.x1, { high: 0.6 })
    + front.svg
    // The near end is glass too, so the court reads boxed in
    + glassRow([c.x0, c.y1], [c.x1, c.y1], 2, 3)
    + tube(P(c.x1, c.y1, 0), P(c.x1, c.y1, 2), 'post', 2.4)
    + tube(P(c.x1, c.y0, 0), P(c.x1, c.y0, 3), 'post', 2.4)
    + bench(7.75, 7.8, 2.6, 'bag')
    + cylinder(8.1, 11.6, 0.2, 0.62, 'tube')
    + looseBalls([[7.6, 5.4], [8.4, 6.2]])
    + ball(back, front, 26)
    + '</svg>';
}

/* ---------- Beach tennis: ribbon lines on sand, a tall net, a palm ---------- */
function beach() {
  const id = 'beach';
  const W = 9;
  const D = 14;
  const c = { x0: 2.2, x1: 6.8, y0: 2, y1: 12, net: 7 };
  const back = player(5.3, 3.2, { look: 'b', racket: 'paddle', flip: true });
  const front = player(3.6, 11.2, { look: 'a', racket: 'paddle' });

  // A palm in the far corner: a bent trunk and a crown of leaves
  const [bx, by] = P(0.95, 0.95);
  const [tx, ty] = [bx + 14, by - 64];
  const trunk = `M${f(bx)} ${f(by)}Q${f(bx + 2)} ${f(by - 36)} ${f(tx)} ${f(ty)}`;
  const leaf = (dx, dy, bend) => `<path d="M${f(tx)} ${f(ty)}Q${f(tx + dx / 2 + bend)} ${f(ty + dy / 2 - 14)} ${f(tx + dx)} ${f(ty + dy)}Q${f(tx + dx / 2)} ${f(ty + dy / 2 - 4)} ${f(tx)} ${f(ty)}Z" style="${st('leaf', 'ink', 1.4)}"/>`;
  const palm = groundShadow(0.7, 0.7, 1.3, 1.3, 0.2)
    + `<path d="${trunk}" style="${stroke('ink', 7.4)}"/><path d="${trunk}" style="${stroke('trunk', 5)}"/>`
    + leaf(-30, 10, -6) + leaf(30, 12, 6) + leaf(-22, -14, -4) + leaf(24, -12, 4) + leaf(4, 20, 2);

  // A striped umbrella on the left, behind the net, with its shadow
  const umbrella = (() => {
    const at = [1.05, 4.4];
    const h = 2.2;
    const r = 1.15;
    const apex = P(at[0], at[1], h + 0.55);
    const rim = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { a, p: P(at[0] + r * Math.cos(a), at[1] + r * Math.sin(a), h) };
    });
    // Back slices first, so the near ones cover them
    const slices = rim.map((q, i) => ({ q, n: rim[(i + 1) % 8], i, depth: Math.cos(q.a) + Math.sin(q.a) }))
      .sort((a, b) => a.depth - b.depth);
    const [sx, sy] = P(at[0] + 0.7, at[1] + 0.5);
    return `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx="${f(1.2247 * r * U)}" ry="${f(0.7071 * r * U)}" style="fill:var(--cb-shade)"/>`
      + tube(P(at[0], at[1], 0), P(at[0], at[1], h + 0.5), 'pole', 1.6)
      + slices.map(({ q, n, i }) => poly([apex, q.p, n.p], st(i % 2 ? 'stripe' : 'canopy', 'ink', 1.3))).join('');
  })();

  return svgOpen(id)
    + slab({ w: W, d: D, tone: 'beach' })
    + palm
    // Ribbon lines pinned on the sand
    + poly(flat(c.x0, c.y0, c.x1, c.y1), stroke('ribbon', 2.6))
    + ballShadow(back, front)
    + umbrella
    + back.svg
    + net(id, c.net, c.x0 - 0.45, c.x1 + 0.45, { low: 0.55, high: 1.25, tape: 'line', post: 'pole' })
    + front.svg
    + poly(flat(7.55, 8.8, 8.55, 11.2, 0.02), st('towel', 'ink', 1.4))
    + seg(P(7.55, 9.4, 0.02), P(8.55, 9.4, 0.02), stroke('towel-stripe', 2.4))
    + seg(P(7.55, 10.6, 0.02), P(8.55, 10.6, 0.02), stroke('towel-stripe', 2.4))
    + box(7.65, 5.6, 0, 0.75, 1.05, 0.62, { top: 'cooler-top', right: 'cooler-side', left: 'cooler-side' })
    + looseBalls([[8.1, 12.4], [1.6, 12.2]])
    + ball(back, front, 52)
    + '</svg>';
}

export const SPORTS = ['tennis', 'padel', 'beach'];
export const courts = { tennis, padel, beach };
