/* ==========================================================================
   001 · Currency pair picker
   A deck of currency coins spins at the top of a transfer card as an
   illustration of what you build below. Pick what you send in its select and
   the deck settles on that coin, alone in the middle. Pick what they receive
   and the second coin flips in beside it. Then the amount is typed in, and
   the conversion rolls in after it.
   Rates and amounts are illustrative, not live quotes.
   ========================================================================== */
(() => {
  /* ---------- Data ---------- */
  // Units per 1 EUR: illustrative values for the design, not market rates
  const CURRENCIES = [
    { code: 'USD', name: 'US dollar', perEur: 1.0842, send: 25000, decimals: 2 },
    { code: 'EUR', name: 'Euro', perEur: 1, send: 20000, decimals: 2 },
    { code: 'GBP', name: 'British pound', perEur: 0.8461, send: 18000, decimals: 2 },
    { code: 'BRL', name: 'Brazilian real', perEur: 5.6069, send: 160000, decimals: 2 },
    { code: 'JPY', name: 'Japanese yen', perEur: 162.37, send: 3500000, decimals: 0 },
    { code: 'CHF', name: 'Swiss franc', perEur: 0.9583, send: 20000, decimals: 2 },
    { code: 'CAD', name: 'Canadian dollar', perEur: 1.4791, send: 35000, decimals: 2 },
    { code: 'SEK', name: 'Swedish krona', perEur: 11.4127, send: 250000, decimals: 2 },
    { code: 'INR', name: 'Indian rupee', perEur: 90.2236, send: 2000000, decimals: 2 },
    // Receive-only, so it shows as unavailable in the "you send" list
    { code: 'ARS', name: 'Argentine peso', perEur: 1027.55, decimals: 2, receiveOnly: true },
  ];
  const DEMO = { from: 'BRL', to: 'EUR' };
  const byCode = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));
  const codes = CURRENCIES.map((c) => c.code);

  /* ---------- Geometry and timing ---------- */
  const R = 105;       // deck radius
  const PAIR_X = 24;   // the two tokens meet either side of centre
  const RIMS = 4;      // stacked discs that give each coin an edge
  const CELLS = 21;    // odometer strip: a blank, then 0-9 twice
  const SPIN = { idle: 2.8, settle: 1, wake: 1.6 };
  // One full turn per loop: steady spin, ease into the pick, ease back out
  const V = 360 / (SPIN.idle + SPIN.settle / 2 + SPIN.wake / 2); // degrees per second
  const STEP = 360 / codes.length;
  const PHI_SEL = -STEP * codes.indexOf(DEMO.from) - 360;
  const PHI0 = PHI_SEL + V * (SPIN.idle + SPIN.settle / 2);

  /* ---------- Flags (64 x 64, cropped to a circle) ---------- */
  const star = (cx, cy, r) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? r * 0.4 : r;
      points.push(`${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`);
    }
    return `<polygon points="${points.join(' ')}"/>`;
  };
  const bands = (colors) => colors.map((c, i) => {
    const h = 64 / colors.length;
    return `<rect y="${(i * h).toFixed(2)}" width="64" height="${(h + 0.5).toFixed(2)}" fill="${c}"/>`;
  }).join('');
  const MAPLE = [[0, -14], [2, -10], [4.2, -11.2], [3.4, -5.4], [7.6, -8.6], [8.2, -6.6], [11.6, -7.4],
    [10.6, -3.8], [12.4, -2.8], [6, 2.2], [6.8, 4.4], [1, 3.6], [1, 11]];
  const maple = () => {
    const points = [...MAPLE, ...MAPLE.slice(1).reverse().map(([x, y]) => [-x, y])];
    return `<polygon fill="#D80621" points="${points.map(([x, y]) => `${(32 + x * 1.2).toFixed(2)},${(33 + y * 1.2).toFixed(2)}`).join(' ')}"/>`;
  };

  const FLAGS = {
    USD() {
      const h = 64 / 13;
      let s = '<rect width="64" height="64" fill="#fff"/>';
      for (let i = 0; i < 13; i += 2) s += `<rect y="${(i * h).toFixed(2)}" width="64" height="${h.toFixed(2)}" fill="#B22234"/>`;
      s += `<rect width="30" height="${(7 * h).toFixed(2)}" fill="#3C3B6E"/>`;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) s += `<circle cx="${(5 + c * 6.8 + (r % 2) * 3.4).toFixed(1)}" cy="${(5 + r * 7.6).toFixed(1)}" r="1.3" fill="#fff"/>`;
      }
      return s;
    },
    EUR() {
      let s = '<rect width="64" height="64" fill="#039"/><g fill="#FC0">';
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        s += star(32 + 19 * Math.cos(a), 32 + 19 * Math.sin(a), 3.6);
      }
      return `${s}</g>`;
    },
    GBP: () => '<rect width="64" height="64" fill="#012169"/>'
      + '<path d="M0 0l64 64M64 0L0 64" stroke="#fff" stroke-width="12"/>'
      + '<path d="M0 0l64 64M64 0L0 64" stroke="#C8102E" stroke-width="4"/>'
      + '<path d="M32 0v64M0 32h64" stroke="#fff" stroke-width="18"/>'
      + '<path d="M32 0v64M0 32h64" stroke="#C8102E" stroke-width="10"/>',
    BRL: () => '<rect width="64" height="64" fill="#009C3B"/><path d="M32 9 59 32 32 55 5 32z" fill="#FFDF00"/>'
      + '<circle cx="32" cy="32" r="12.5" fill="#002776"/>'
      + '<path d="M19.8 29.6c8-2.6 17.2-1.4 24.4 4.6" stroke="#fff" stroke-width="2.4" fill="none"/>',
    JPY: () => '<rect width="64" height="64" fill="#fff"/><circle cx="32" cy="32" r="13" fill="#BC002D"/>',
    CHF: () => '<rect width="64" height="64" fill="#DA291C"/><path d="M27 14h10v13h13v10H37v13H27V37H14V27h13z" fill="#fff"/>',
    CAD: () => '<rect width="64" height="64" fill="#fff"/><rect width="16" height="64" fill="#D80621"/>'
      + `<rect x="48" width="16" height="64" fill="#D80621"/>${maple()}`,
    SEK: () => '<rect width="64" height="64" fill="#006AA7"/><path d="M19 0h10v27h35v10H29v27H19V37H0V27h19z" fill="#FECC00"/>',
    INR() {
      let s = `${bands(['#FF9933', '#fff', '#138808'])}<g stroke="#000080" fill="none"><circle cx="32" cy="32" r="6.6" stroke-width="1.3"/>`;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        s += `<path d="M32 32L${(32 + 6.4 * Math.cos(a)).toFixed(2)} ${(32 + 6.4 * Math.sin(a)).toFixed(2)}" stroke-width="0.6"/>`;
      }
      return `${s}</g>`;
    },
    ARS: () => `${bands(['#74ACDF', '#fff', '#74ACDF'])}<circle cx="32" cy="32" r="5.2" fill="#F6B40E" stroke="#85340A" stroke-width="0.6"/>`,
  };
  const FLAG = Object.fromEntries(codes.map((code) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${FLAGS[code]()}</svg>`;
    return [code, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`];
  }));

  /* ---------- Elements ---------- */
  const token = Loop.token;
  const stage = document.querySelector('.stage');
  const card = stage.querySelector('.card');
  const ring = card.querySelector('.deck__ring');
  const tokens = {
    from: card.querySelector('[data-token="from"]'),
    to: card.querySelector('[data-token="to"]'),
  };
  const msg = Object.fromEntries([...card.querySelectorAll('[data-msg]')].map((el) => [el.dataset.msg, el]));
  const rateEl = card.querySelector('[data-rate]');
  const errorEl = card.querySelector('[data-error]');
  const metaEmpty = card.querySelectorAll('.meta__value [data-empty]');
  const metaFilled = card.querySelectorAll('.meta__value [data-filled]');
  const metaIcons = card.querySelectorAll('.meta__icon');
  const rateState = card.querySelector('[data-rate-state]');
  const cta = card.querySelector('.cta');
  const picker = card.querySelector('.picker');
  const statusLine = card.querySelector('.picker__status');

  const row = (side) => {
    const select = card.querySelector(`.select[data-side="${side}"]`);
    const pill = select.querySelector('.pill');
    const amount = card.querySelector(`.amount[data-side="${side}"]`);
    return {
      side,
      select,
      pill,
      chevron: pill.querySelector('.pill__chevron'),
      empty: pill.querySelector('.pill__empty'),
      filled: pill.querySelector('.pill__filled'),
      flag: pill.querySelector('.flag'),
      code: pill.querySelector('[data-code]'),
      dropdown: select.querySelector('.dropdown'),
      list: select.querySelector('.dropdown__list'),
      amount,
      amountEmpty: amount.querySelector('.amount__empty'),
      odo: amount.querySelector('.odo'),
      srText: amount.querySelector('[data-amount-text]'),
      typed: amount.querySelector('.amount__typed'),
      caret: amount.querySelector('.amount__caret'),
      input: amount.querySelector('.amount__input'),
      focusLine: amount.querySelector('.amount__focus'),
      mirror: amount.querySelector('.amount__mirror'),
    };
  };
  const rows = { from: row('from'), to: row('to') };

  /* ---------- Coins and the deck ---------- */
  const slots = new WeakMap();

  function coinFaces(code, el) {
    el.style.setProperty('--flag', FLAG[code]);
    let rims = '';
    for (let i = 0; i < RIMS; i++) rims += `<span class="coin__rim" style="--i:${i}"></span>`;
    el.innerHTML = `<span class="coin__face"></span>${rims}<span class="coin__face coin__face--back"></span>`;
  }

  // Coins stand on a ring, each facing out; the ring turns, not the coins
  function fillRing() {
    codes.forEach((code, i) => {
      const coin = document.createElement('span');
      coin.className = 'coin';
      coin.dataset.code = code;
      coinFaces(code, coin);
      const angle = i * STEP;
      const rad = (angle * Math.PI) / 180;
      slots.set(coin, { x: R * Math.sin(rad), z: R * Math.cos(rad), rotationY: angle });
      gsap.set(coin, slots.get(coin));
      ring.append(coin);
    });
  }

  const coinOf = (code) => ring.querySelector(`[data-code="${code}"]`);
  const gap = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

  // Everyone but the pick, nearest first, so the deck folds in from the front
  const othersOf = (picked) => {
    const a = slots.get(picked).rotationY;
    return [...ring.children].filter((c) => c !== picked)
      .sort((p, q) => gap(slots.get(p).rotationY, a) - gap(slots.get(q).rotationY, a));
  };

  // Ring angle that brings a coin to the front, turning the way the deck spins
  const frontAngle = (current, slotAngle, minTurn = 0) => {
    const target = -slotAngle;
    return target - 360 * Math.ceil((target - (current - minTurn)) / 360);
  };

  /* ---------- Lists ---------- */
  const CHECK = '<svg class="icon option__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  function buildList(r) {
    r.list.innerHTML = '<li class="dropdown__hl" role="presentation"></li>';
    for (const cur of CURRENCIES) {
      const li = document.createElement('li');
      li.className = 'option';
      li.id = `${r.side}-${cur.code}`;
      li.setAttribute('role', 'option');
      li.dataset.code = cur.code;
      li.innerHTML = `<span class="flag"></span><span class="option__code">${cur.code}</span>`
        + `<span class="option__name"></span>${CHECK}`;
      li.firstElementChild.style.setProperty('--flag', FLAG[cur.code]);
      r.list.append(li);
    }
    r.hl = r.list.querySelector('.dropdown__hl');
  }

  const optionOf = (r, code) => r.list.querySelector(`[data-code="${code}"]`);
  const options = (r) => [...r.list.querySelectorAll('.option')];
  const enabled = (r) => options(r).filter((o) => o.getAttribute('aria-disabled') !== 'true');

  // Which options can't be picked, and why, written out next to them
  function renderList(r, { from, to }) {
    for (const li of options(r)) {
      const cur = byCode[li.dataset.code];
      let reason = '';
      if (r.side === 'from' && cur.receiveOnly) reason = 'Receive only';
      else if (r.side === 'from' && cur.code === to) reason = 'Receiving';
      else if (r.side === 'to' && cur.code === from) reason = 'Sending';
      li.querySelector('.option__name').textContent = reason || cur.name;
      if (reason) li.setAttribute('aria-disabled', 'true');
      else li.removeAttribute('aria-disabled');
      li.setAttribute('aria-selected', String(cur.code === (r.side === 'from' ? from : to)));
    }
  }

  /* ---------- Numbers ---------- */
  const format = (value, decimals) => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  const receive = (from, to) => from.send * (to.perEur / from.perEur);
  const rateText = (from, to) => {
    const rate = from.perEur / to.perEur;
    return `1 ${to.code} = ${format(rate, rate >= 1 ? 4 : 6)} ${from.code}`;
  };

  function buildOdo(odo, text) {
    odo.textContent = '';
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'odo__col';
        const strip = document.createElement('span');
        strip.className = 'odo__strip';
        strip.dataset.target = 11 + Number(ch);
        strip.innerHTML = `<span>&nbsp;</span>${'01234567890123456789'.replace(/\d/g, '<span>$&</span>')}`;
        col.append(strip);
        odo.append(col);
      } else {
        const sep = document.createElement('span');
        sep.className = 'odo__sep';
        sep.textContent = ch;
        odo.append(sep);
      }
    }
  }

  function setAmount(r, cur, value) {
    const text = format(value, cur.decimals);
    buildOdo(r.odo, text);
    r.srText.textContent = `${text} ${cur.code}`;
    // Long numbers shrink to fit next to the pill
    r.amount.style.removeProperty('--amount-size');
    const max = parseFloat(token('--fx-amount-w'));
    const width = r.odo.scrollWidth;
    if (width > max) r.amount.style.setProperty('--amount-size', `${(parseFloat(token('--fx-fs-amount')) * max) / width}px`);
  }

  function showCurrency(r, cur) {
    r.flag.style.setProperty('--flag', FLAG[cur.code]);
    r.code.textContent = cur.code;
  }

  // For the loop: one state per keystroke ("1", "16" … "160,000"), then the
  // amount written out in full once the field lets go ("160,000.00")
  function buildTyped(r, cur, value) {
    const digits = String(Math.trunc(value));
    const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let html = '';
    for (let i = 1; i <= digits.length; i++) {
      const text = group(digits.slice(0, i));
      html += `<span class="typed">${text.slice(0, -1)}<span class="typed__new">${text.slice(-1)}</span></span>`;
    }
    const full = format(value, cur.decimals);
    const dot = full.indexOf('.');
    const tail = dot === -1 ? '' : `<span class="typed__dec">${full.slice(dot)}</span>`;
    html += `<span class="typed typed--final">${dot === -1 ? full : full.slice(0, dot)}${tail}</span>`;
    r.typed.innerHTML = html;
  }

  // Typing keeps digits and one decimal point, and groups thousands as you go
  function tidy(raw, caret, decimals) {
    const kept = raw.slice(0, caret).replace(/[^\d.]/g, '').length;
    const clean = raw.replace(/[^\d.]/g, '');
    const dot = clean.indexOf('.');
    const int = (dot === -1 ? clean : clean.slice(0, dot)).replace(/^0+(?=\d)/, '').slice(0, 9);
    const dec = dot === -1 || decimals === 0 ? null : clean.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
    const text = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec === null ? '' : `.${dec}`);
    let pos = 0;
    for (let seen = 0; pos < text.length && seen < kept; pos++) if (text[pos] !== ',') seen++;
    return { text, caret: pos, value: Number(`${int || 0}.${dec || 0}`) };
  }

  // Long amounts shrink so they never run under the pill
  function fitInput() {
    const r = rows.from;
    r.amount.style.removeProperty('--amount-size');
    r.mirror.textContent = r.input.value || r.input.placeholder;
    const room = r.amount.clientWidth;
    const width = r.mirror.offsetWidth;
    if (width > room) r.amount.style.setProperty('--amount-size', `${(parseFloat(token('--fx-fs-amount')) * room) / width}px`);
  }

  /* The deck is tilted, so its front coin sits low. Once a coin is picked it
     rises to this local y: the middle of the free space above the status line. */
  let lift = 0;
  function measureLift() {
    const target = (picker.getBoundingClientRect().top + statusLine.getBoundingClientRect().top) / 2;
    const centreAt = (y) => {
      gsap.set(tokens.from, { y });
      const r = tokens.from.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    };
    const c0 = centreAt(0);
    const perPx = (centreAt(-20) - c0) / -20;
    gsap.set(tokens.from, { y: 0 });
    return (target - c0) / perPx;
  }

  // The card as the loop starts it: empty, with the demo pair ready underneath
  function setBase() {
    const from = byCode[DEMO.from];
    const to = byCode[DEMO.to];
    coinFaces(from.code, tokens.from);
    coinFaces(to.code, tokens.to);
    tokens.from.style.removeProperty('--flag-back');
    tokens.to.style.removeProperty('--flag-back');
    gsap.set(tokens.from, { x: 0, y: 0, z: R, rotationY: 0, scale: 1 });
    lift = measureLift();
    gsap.set(tokens.to, { x: PAIR_X, y: lift, z: R + 3, rotationY: 0, scale: 1 });
    showCurrency(rows.from, from);
    showCurrency(rows.to, to);
    buildTyped(rows.from, from, from.send);
    rows.from.input.value = '';
    rows.from.input.disabled = true;
    fitInput();
    setAmount(rows.to, to, receive(from, to));
    rows.to.srText.textContent = 'Not set';
    rateEl.textContent = rateText(from, to);
    // The demo opens the first list before anything is picked, the second after
    renderList(rows.from, { from: null, to: null });
    renderList(rows.to, { from: from.code, to: null });
    for (const r of Object.values(rows)) {
      delete r.select.dataset.open;
      r.pill.setAttribute('aria-expanded', 'false');
      r.list.removeAttribute('aria-activedescendant');
      r.list.scrollTop = 0;
      r.list.removeAttribute('data-scrolled');
      r.list.removeAttribute('data-end');
      delete r.hl.dataset.on;
    }
    cta.disabled = true;
    delete cta.dataset.state;
    cta.removeAttribute('aria-busy');
    rateState.textContent = 'Live';
  }

  /* ---------- Motion pieces, shared by the loop and by live picks ---------- */
  function swap(tl, out, into, at) {
    tl.to(out, { autoAlpha: 0, y: -6, duration: 0.2, ease: 'power2.in' }, at)
      .fromTo(into, { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', immediateRender: false }, at + 0.12);
  }

  /* Coins shrink and grow instead of fading: opacity on a 3D element flattens
     it, and a flat coin shows its rim and back face through the front. */
  function collapse(tl, coins, at) {
    tl.to(coins, { x: 0, z: 0, scale: 0, duration: 0.45, ease: 'power2.in', stagger: 0.025 }, at)
      .set(coins, { visibility: 'hidden' }, at + 0.45 + 0.025 * coins.length);
  }

  function expand(tl, coins, at, duration = 0.7) {
    tl.set(coins, { visibility: 'visible' }, at)
      .fromTo(coins, { x: 0, z: 0, scale: 0 }, {
        x: (i, el) => slots.get(el).x,
        z: (i, el) => slots.get(el).z,
        scale: 1,
        duration,
        ease: 'power3.out',
        stagger: 0.03,
        immediateRender: false,
      }, at);
  }

  // Swap a ring coin for a token in the same spot, so the change can't be seen
  function handoff(tl, from, to, at) {
    tl.set(from, { visibility: 'hidden' }, at).set(to, { visibility: 'visible' }, at);
  }

  // The picked coin leaves the deck's front edge and rises to the centre
  function rise(tl, at) {
    tl.to(tokens.from, { y: lift, duration: 0.55, ease: 'power3.inOut' }, at)
      .to(tokens.from, { scale: 1.08, duration: 0.2, ease: 'power2.out' }, at)
      .to(tokens.from, { scale: 1, duration: 0.35, ease: 'back.out(2)' }, at + 0.2);
  }

  // The second coin flips in from behind the first and both settle side by side
  function pairIn(tl, at) {
    tl.to(tokens.from, { x: -PAIR_X, duration: 0.6, ease: 'power3.inOut' }, at)
      .set(tokens.to, { visibility: 'visible' }, at)
      .fromTo(tokens.to, { x: 0, y: lift, z: R - 30, rotationY: -160, scale: 0.5 },
        { x: PAIR_X, y: lift, z: R + 3, rotationY: 0, scale: 1, duration: 0.75, ease: 'power3.out', immediateRender: false }, at);
  }

  // The second coin folds back behind the first, which sinks back to the deck's front
  function pairOut(tl, at) {
    tl.to(tokens.to, { x: 0, z: R - 30, rotationY: 160, scale: 0.4, duration: 0.45, ease: 'power2.in' }, at)
      .set(tokens.to, { visibility: 'hidden' }, at + 0.45)
      .to(tokens.from, { x: 0, y: 0, duration: 0.5, ease: 'power3.inOut' }, at);
  }

  // A token turns over to show its new flag on the back, then rests face up
  function flipToken(tl, el, code, at) {
    el.style.setProperty('--flag-back', FLAG[code]);
    tl.to(el, { rotationY: '+=180', duration: 0.5, ease: 'power2.inOut' }, at)
      .set(el, { rotationY: 0, '--flag': FLAG[code] }, at + 0.5);
  }

  function fillPill(tl, r, at) {
    swap(tl, r.empty, r.filled, at);
    tl.fromTo(r.flag, { scale: 0.4 }, { scale: 1, duration: 0.3, ease: 'back.out(2.2)', immediateRender: false }, at + 0.12);
  }

  function rollIn(tl, r, at) {
    const seps = r.odo.querySelectorAll('.odo__sep');
    tl.to(r.amountEmpty, { autoAlpha: 0, y: -6, duration: 0.2, ease: 'power2.in' }, at)
      .set(seps, { autoAlpha: 0 }, at)
      .set(r.odo, { autoAlpha: 1, y: 0 }, at)
      .fromTo(r.odo, { '--fade': '30%' }, { '--fade': '0%', duration: 1, ease: 'power2.in', immediateRender: false }, at)
      .fromTo(r.odo.querySelectorAll('.odo__strip'), { yPercent: 0 }, {
        yPercent: (i, el) => (-100 * el.dataset.target) / CELLS,
        duration: 0.9,
        ease: 'power3.out',
        stagger: { each: 0.035, from: 'end' },
        immediateRender: false,
      }, at)
      .to(seps, { autoAlpha: 1, duration: 0.2 }, at + 0.2);
  }

  function rollOut(tl, r, at) {
    tl.to(r.odo, { autoAlpha: 0, y: -8, duration: 0.25, ease: 'power2.in' }, at)
      .set(r.odo.querySelectorAll('.odo__strip'), { yPercent: 0 }, at + 0.3)
      .set(r.odo, { y: 0 }, at + 0.3)
      .fromTo(r.amountEmpty, { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', immediateRender: false }, at + 0.2);
  }

  function metaIn(tl, at) {
    swap(tl, metaEmpty, metaFilled, at);
    tl.to(metaIcons, { color: token('--fx-text'), duration: 0.25 }, at);
  }

  function metaOut(tl, at) {
    swap(tl, metaFilled, metaEmpty, at);
    tl.to(metaIcons, { color: token('--fx-text-muted'), duration: 0.25 }, at);
  }

  // Seconds between keystrokes, a little uneven like real typing
  const KEYS = [0, 0.15, 0.29, 0.48, 0.61, 0.77];
  const keyAt = (i) => KEYS[i] ?? KEYS[KEYS.length - 1] + (i - KEYS.length + 1) * 0.15;

  // A click in the amount, the caret blinks, then one key at a time.
  // Returns the moment the field lets go and the amount is written out.
  function typeIn(tl, r, at) {
    const states = [...r.typed.querySelectorAll('.typed')];
    const final = states.pop();
    const start = at + 0.55;
    tl.to(r.focusLine, { scaleX: 1, duration: 0.3, ease: 'power3.out' }, at)
      .set(r.caret, { autoAlpha: 1 }, at)
      .set(r.caret, { autoAlpha: 0 }, at + 0.27)
      .set(r.caret, { autoAlpha: 1 }, at + 0.52);
    states.forEach((state, i) => {
      const t = start + keyAt(i);
      if (i === 0) tl.set(r.amountEmpty, { autoAlpha: 0 }, t); // a placeholder goes on the first key
      else tl.set(states[i - 1], { autoAlpha: 0 }, t);
      tl.set(state, { autoAlpha: 1 }, t)
        .fromTo(state.querySelector('.typed__new'), { yPercent: 35, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.12, ease: 'power2.out', immediateRender: false }, t);
    });
    const commit = start + keyAt(states.length - 1) + 0.35;
    tl.set(states[states.length - 1], { autoAlpha: 0 }, commit)
      .set(final, { autoAlpha: 1 }, commit)
      .set(r.caret, { autoAlpha: 0 }, commit)
      .to(r.focusLine, { scaleX: 0, duration: 0.25, ease: 'power2.in' }, commit);
    const dec = final.querySelector('.typed__dec');
    if (dec) {
      tl.fromTo(dec, { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out', immediateRender: false }, commit);
    }
    return commit;
  }

  function typedOut(tl, r, at) {
    const final = r.typed.querySelector('.typed--final');
    tl.to(final, { autoAlpha: 0, y: -6, duration: 0.2, ease: 'power2.in' }, at)
      .set(final, { y: 0 }, at + 0.25)
      .fromTo(r.amountEmpty, { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', immediateRender: false }, at + 0.2);
  }

  /* ---------- Demo-only pieces: what CSS states do for a real pointer ---------- */
  const fill = (el, color, at, duration = 0.15) => ({ el, color, at, duration });
  function paint(tl, ...steps) {
    for (const s of steps) tl.to(s.el, { backgroundColor: token(s.color), duration: s.duration }, s.at);
  }

  function openList(tl, r, at) {
    const dy = r.dropdown.dataset.dir === 'up' ? 6 : -6;
    tl.fromTo(r.dropdown, { autoAlpha: 0, scale: 0.96, y: dy },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.22, ease: 'power2.out', immediateRender: false }, at)
      .to(r.chevron, { rotation: 180, duration: 0.25, ease: 'power2.inOut' }, at);
  }

  function closeList(tl, r, at) {
    tl.to(r.dropdown, { autoAlpha: 0, scale: 0.98, duration: 0.16, ease: 'power2.in' }, at)
      .to(r.chevron, { rotation: 0, duration: 0.25, ease: 'power2.inOut' }, at)
      .set(r.hl, { opacity: 0 }, at + 0.2);
  }

  // The highlight follows the pointer down the list to the option it picks
  function glide(tl, r, fromOpt, toOpt, at, duration) {
    tl.set(r.hl, { y: fromOpt.offsetTop }, at)
      .to(r.hl, { opacity: 1, duration: 0.1 }, at)
      .to(r.hl, { y: toOpt.offsetTop, duration, ease: 'power3.inOut' }, at);
  }

  /* ---------- The loop ---------- */
  function restPoint() {
    const s = stage.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { x: Math.min(c.right - s.left + 28, s.width - 28), y: c.top - s.top + c.height * 0.4 };
  }

  function build(tl, cursor) {
    const coin = coinOf(DEMO.from);
    const others = othersOf(coin);
    const rest = restPoint();
    const fromOpt = optionOf(rows.from, DEMO.from);
    const toOpt = optionOf(rows.to, DEMO.to);
    const T1 = SPIN.idle;           // the first pick lands
    const PICK2 = 6.05;             // the second pick lands
    const TYPE = 7.3;               // the amount field takes the click

    // 0. The deck spins on its own
    tl.fromTo(ring, { rotationY: PHI0 }, { rotationY: PHI0 - V * T1, duration: T1, ease: 'none' }, 0);
    cursor.set(rest, 0);

    // 1. Open "You send" and pick BRL
    cursor.move(rows.from.pill, 0.5, { duration: 0.9, ox: 0.4, oy: 0.55 });
    paint(tl, fill(rows.from.pill, '--fx-control-hover', 1.4));
    cursor.press(1.6);
    paint(tl,
      fill(rows.from.pill, '--fx-control-active', 1.6, 0.08),
      fill(rows.from.pill, '--fx-control-hover', 1.7));
    openList(tl, rows.from, 1.7);
    cursor.move(fromOpt, 2, { duration: 0.6, ox: 0.3, oy: 0.55 });
    glide(tl, rows.from, options(rows.from)[0], fromOpt, 2.05, 0.55);
    cursor.press(T1 - 0.05);
    paint(tl,
      fill(rows.from.hl, '--fx-control-active', T1 - 0.05, 0.08),
      fill(rows.from.hl, '--fx-control', T1 + 0.05));
    closeList(tl, rows.from, T1 + 0.05);
    paint(tl, fill(rows.from.pill, '--fx-control', T1 + 0.05, 0.2));
    fillPill(tl, rows.from, T1 + 0.05);
    swap(tl, msg.from, msg.to, T1 + 0.1);

    // 2. The deck settles on BRL, folds away and leaves it alone in the middle
    tl.to(ring, { rotationY: PHI_SEL, duration: SPIN.settle, ease: 'power2.out' }, T1);
    collapse(tl, others, T1 + 0.3);
    handoff(tl, coin, tokens.from, T1 + SPIN.settle);
    rise(tl, T1 + SPIN.settle);

    // 3. Open "Recipient gets" and pick EUR
    cursor.move(rows.to.pill, 3.9, { duration: 0.85, ox: 0.4, oy: 0.55 });
    paint(tl, fill(rows.to.pill, '--fx-control-hover', 4.65));
    cursor.press(4.85);
    paint(tl,
      fill(rows.to.pill, '--fx-control-active', 4.85, 0.08),
      fill(rows.to.pill, '--fx-control-hover', 4.95));
    openList(tl, rows.to, 4.95);
    cursor.move(toOpt, 5.2, { duration: 0.6, ox: 0.3, oy: 0.55 });
    glide(tl, rows.to, options(rows.to)[0], toOpt, 5.3, 0.45);
    cursor.press(PICK2 - 0.1);
    paint(tl,
      fill(rows.to.hl, '--fx-control-active', PICK2 - 0.1, 0.08),
      fill(rows.to.hl, '--fx-control', PICK2));
    closeList(tl, rows.to, PICK2);
    paint(tl, fill(rows.to.pill, '--fx-control', PICK2, 0.2));

    // 4. EUR flips in beside BRL, and the rate comes with the pair
    pairIn(tl, PICK2);
    fillPill(tl, rows.to, PICK2);
    swap(tl, msg.to, msg.rate, PICK2 + 0.1);

    // 5. Click the amount and type it; the conversion rolls in after
    cursor.move(rows.from.amount, PICK2 + 0.35, { duration: 0.8, ox: 0.72, oy: 0.55 });
    cursor.press(TYPE - 0.05);
    cursor.move(rows.from.amount, TYPE + 0.15, { duration: 0.5, ox: 0.92, oy: 1.6 });
    const typed = typeIn(tl, rows.from, TYPE);
    rollIn(tl, rows.to, typed + 0.08);
    metaIn(tl, typed + 0.25);
    tl.to(cta, { backgroundColor: token('--fx-accent'), color: token('--fx-on-accent'), duration: 0.25 }, typed + 0.4);
    cursor.move(cta, typed + 0.4, { duration: 0.85, ox: 0.68, oy: 0.6 });
    paint(tl, fill(cta, '--fx-accent-hover', typed + 1.25));

    // 6. Hold, then everything folds back into the spinning deck
    const BACK = typed + 2.65;
    const WAKE = BACK + 0.5;        // the token is back at the deck's front
    paint(tl, fill(cta, '--fx-accent', BACK - 0.05));
    cursor.move(rest, BACK, { duration: 0.95 });
    pairOut(tl, BACK);
    tl.to(cta, { backgroundColor: token('--fx-control'), color: token('--fx-text-muted'), duration: 0.25 }, BACK + 0.05);
    swap(tl, msg.rate, msg.from, BACK + 0.05);
    swap(tl, rows.from.filled, rows.from.empty, BACK + 0.05);
    swap(tl, rows.to.filled, rows.to.empty, BACK + 0.05);
    typedOut(tl, rows.from, BACK);
    rollOut(tl, rows.to, BACK);
    metaOut(tl, BACK + 0.05);
    handoff(tl, tokens.from, coin, WAKE);
    expand(tl, others, WAKE + 0.1, 1);
    tl.to(ring, { rotationY: PHI0 - 360, duration: SPIN.wake, ease: 'power2.in' }, WAKE);
  }

  /* ---------- Live: the visitor drives the card ---------- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let live = null;
  let lockTimer;

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
    live = { from: null, to: null, amount: 0, shown: false, busy: false, error: false };
    live.ctx = gsap.context(() => {
      if (!reduce) live.spin = gsap.to(ring, { rotationY: '-=360', duration: 360 / V, ease: 'none', repeat: -1 });
    }, stage);
    renderList(rows.from, live);
    renderList(rows.to, live);
  }

  function stopLive() {
    clearTimeout(lockTimer);
    clearTimeout(convertTimer);
    if (live) live.ctx.revert();
    live = null;
    setBase();
  }

  /* Dropdowns */
  function setActive(r, li) {
    if (!li) return;
    r.list.setAttribute('aria-activedescendant', li.id);
    r.hl.style.setProperty('--hl-y', `${li.offsetTop}px`);
    r.hl.dataset.on = '';
    const top = li.offsetTop - r.list.scrollTop;
    if (top < 0 || top + li.offsetHeight > r.list.clientHeight) li.scrollIntoView({ block: 'nearest' });
  }

  function updateFades(r) {
    const { scrollTop, scrollHeight, clientHeight } = r.list;
    r.list.toggleAttribute('data-scrolled', scrollTop > 0);
    r.list.toggleAttribute('data-end', scrollTop + clientHeight >= scrollHeight - 1);
  }

  function openLive(r) {
    const other = r === rows.from ? rows.to : rows.from;
    closeLive(other);
    r.select.dataset.open = '';
    r.pill.setAttribute('aria-expanded', 'true');
    const picked = live[r.side] && optionOf(r, live[r.side]);
    setActive(r, picked || enabled(r)[0]);
    updateFades(r);
    r.list.focus({ preventScroll: true });
  }

  function closeLive(r, { focusPill = false } = {}) {
    if (!('open' in r.select.dataset)) return;
    delete r.select.dataset.open;
    delete r.hl.dataset.on;
    delete r.hl.dataset.pressed;
    r.pill.setAttribute('aria-expanded', 'false');
    r.list.removeAttribute('aria-activedescendant');
    if (focusPill) r.pill.focus();
  }

  // Asking for what they receive before what you send: say so, point at the field
  function showError() {
    errorEl.textContent = 'Choose what you send first.';
    play((tl) => {
      if (!live.error) swap(tl, msg.from, msg.error, 0);
      tl.fromTo(rows.from.pill, { x: 0 },
        { x: 4, duration: 0.05, yoyo: true, repeat: 5, ease: 'sine.inOut', immediateRender: false }, 0);
    });
    live.error = true;
  }

  function resetLock(tl, at) {
    if (!cta.dataset.state) return;
    clearTimeout(lockTimer);
    delete cta.dataset.state;
    cta.removeAttribute('aria-busy');
    rateState.textContent = 'Live';
    tl.fromTo(cta, { scale: 0.98 }, { scale: 1, duration: 0.2, immediateRender: false }, at);
  }

  // The amount you typed, converted; it rolls in, or rolls away if cleared
  let convertTimer;
  function convert() {
    clearTimeout(convertTimer);
    if (!live || !live.from || !live.to) return;
    const from = byCode[live.from];
    const to = byCode[live.to];
    rateEl.textContent = rateText(from, to);
    if (live.amount > 0) {
      setAmount(rows.to, to, live.amount * (to.perEur / from.perEur));
      const first = !live.shown;
      play((tl) => {
        rollIn(tl, rows.to, 0);
        if (first) metaIn(tl, 0.15);
        resetLock(tl, 0);
      });
      live.shown = true;
      cta.disabled = false;
    } else if (live.shown) {
      play((tl) => {
        rollOut(tl, rows.to, 0);
        metaOut(tl, 0);
        resetLock(tl, 0);
      });
      rows.to.srText.textContent = 'Not set';
      live.shown = false;
      cta.disabled = true;
    }
  }

  function pickFrom(code) {
    const cur = byCode[code];
    const first = !live.from;
    live.from = code;
    live.busy = first;
    showCurrency(rows.from, cur);
    if (live.amount) {
      live.amount = Number(live.amount.toFixed(cur.decimals));
      rows.from.input.value = format(live.amount, cur.decimals);
      fitInput();
    }
    renderList(rows.from, live);
    renderList(rows.to, live);

    play((tl) => {
      if (first) {
        if (live.spin) live.spin.pause();
        const coin = coinOf(code);
        tokens.from.style.setProperty('--flag', FLAG[code]);
        tl.to(ring, {
          rotationY: frontAngle(gsap.getProperty(ring, 'rotationY'), slots.get(coin).rotationY, 30),
          duration: SPIN.settle,
          ease: 'power2.out',
        }, 0);
        collapse(tl, othersOf(coin), 0.3);
        handoff(tl, coin, tokens.from, SPIN.settle);
        rise(tl, SPIN.settle);
        fillPill(tl, rows.from, 0);
        swap(tl, live.error ? msg.error : msg.from, msg.to, 0.05);
        tl.eventCallback('onComplete', () => { live.busy = false; });
      } else {
        flipToken(tl, tokens.from, code, 0);
        tl.fromTo(rows.from.flag, { scale: 0.4 }, { scale: 1, duration: 0.3, ease: 'back.out(2.2)', immediateRender: false }, 0);
      }
    });
    live.error = false;
    if (live.to) convert();
  }

  // Once both currencies are set, the amount field opens for typing
  function pickTo(code) {
    const first = !live.to;
    live.to = code;
    live.busy = first;
    showCurrency(rows.to, byCode[code]);
    rateEl.textContent = rateText(byCode[live.from], byCode[code]);
    renderList(rows.from, live);
    renderList(rows.to, live);

    play((tl) => {
      if (first) {
        tokens.to.style.setProperty('--flag', FLAG[code]);
        pairIn(tl, 0);
        fillPill(tl, rows.to, 0);
        swap(tl, msg.to, msg.rate, 0.1);
        tl.eventCallback('onComplete', () => {
          live.busy = false;
          rows.from.input.disabled = false;
        });
      } else {
        flipToken(tl, tokens.to, code, 0);
        tl.fromTo(rows.to.flag, { scale: 0.4 }, { scale: 1, duration: 0.3, ease: 'back.out(2.2)', immediateRender: false }, 0);
      }
    });
    if (!first) convert();
  }

  function choose(r, li) {
    if (!li || li.getAttribute('aria-disabled') === 'true') return;
    const code = li.dataset.code;
    closeLive(r, { focusPill: true });
    if (code === live[r.side]) return;
    if (r.side === 'from') pickFrom(code);
    else pickTo(code);
  }

  for (const r of Object.values(rows)) {
    buildList(r);

    r.pill.addEventListener('click', () => {
      if (!live || live.busy) return;
      if ('open' in r.select.dataset) closeLive(r);
      else if (r.side === 'to' && !live.from) showError();
      else openLive(r);
    });

    r.pill.addEventListener('keydown', (e) => {
      if (!live || live.busy || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      if (r.side === 'to' && !live.from) showError();
      else openLive(r);
    });

    r.list.addEventListener('pointermove', (e) => {
      const li = e.target.closest('.option');
      if (li && li.id !== r.list.getAttribute('aria-activedescendant')) setActive(r, li);
    });
    r.list.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.option')) r.hl.dataset.pressed = '';
    });
    r.list.addEventListener('click', (e) => {
      delete r.hl.dataset.pressed;
      choose(r, e.target.closest('.option'));
    });
    r.list.addEventListener('scroll', () => updateFades(r));

    // Arrow keys move through the options; Enter or Space picks; Escape closes
    r.list.addEventListener('keydown', (e) => {
      const list = enabled(r);
      const current = list.indexOf(r.list.querySelector(`#${r.list.getAttribute('aria-activedescendant')}`));
      const go = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: list.length - 1 }[e.key];
      if (go !== undefined) {
        e.preventDefault();
        setActive(r, list[Math.max(0, Math.min(list.length - 1, go))]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        choose(r, list[current]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeLive(r, { focusPill: true });
      } else if (e.key === 'Tab') {
        closeLive(r);
      }
    });
  }

  // A press anywhere outside an open list closes it
  document.addEventListener('pointerdown', (e) => {
    if (!live) return;
    for (const r of Object.values(rows)) {
      if (!r.select.contains(e.target)) closeLive(r);
    }
  });

  cta.addEventListener('click', () => {
    if (!live || cta.disabled || cta.dataset.state) return;
    cta.dataset.state = 'loading';
    cta.setAttribute('aria-busy', 'true');
    lockTimer = setTimeout(() => {
      cta.dataset.state = 'done';
      cta.removeAttribute('aria-busy');
      rateState.textContent = 'Locked for 24h';
    }, 900);
  });

  // What you send: groups thousands as you type, converts once you pause
  const amountInput = rows.from.input;
  amountInput.addEventListener('input', () => {
    if (!live || !live.from) return;
    const { text, caret, value } = tidy(amountInput.value, amountInput.selectionStart, byCode[live.from].decimals);
    amountInput.value = text;
    amountInput.setSelectionRange(caret, caret);
    live.amount = value;
    fitInput();
    clearTimeout(convertTimer);
    convertTimer = setTimeout(convert, 350);
  });

  // Leaving the field writes the amount out in full: 160000 becomes 160,000.00
  amountInput.addEventListener('blur', () => {
    if (!live || !live.amount) return;
    amountInput.value = format(live.amount, byCode[live.from].decimals);
    fitInput();
  });
  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') amountInput.blur();
  });

  /* ---------- Start ---------- */
  Promise.all([
    document.fonts.load('800 40px "Inter Tight"'),
    document.fonts.load('600 16px "Inter Tight"'),
    document.fonts.load('500 14px "Inter Tight"'),
    document.fonts.load('400 14px "Inter Tight"'),
  ]).finally(() => {
    fillRing();
    gsap.set(ring, { rotationY: PHI0 });
    setBase();
    Loop.start({ build, fit: '.card', rest: 10.8, live: startLive, reset: stopLive });
  });
})();
