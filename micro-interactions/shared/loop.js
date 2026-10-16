/* ==========================================================================
   Micro-interactions: loop runner
   Load after gsap.min.js. Each exploration describes its loop once:

       Loop.start({
         build(tl, cursor) { ... },  // add every tween to tl; end where it starts
         rest: 0,                    // second shown when motion is reduced
         cursor: 'arrow',            // 'arrow' | 'dot' | false
         fit: '.card',               // optional: scaled down to fit small stages
                                     //   (never animate this element with GSAP)
         live() { ... },             // optional: the visitor took over
         reset() { ... },            // optional: undo what live handlers changed
         frame() { ... },            // optional: draw a canvas (WebGL) after each
                                     //   seek; on screen, add it to gsap.ticker
       });

   Rules that keep a loop recordable frame by frame:
   - every visual change goes through tl: no CSS transitions or keyframes
     in the demo, no tl.call(), no unseeded Math.random();
   - the last frame matches the first.

   Modes, set on <html data-mode>:
   - demo    the loop plays (the default view)
   - live    the visitor's pointer or keyboard is on the component: the loop
             is reverted and the component answers to its real CSS states
   - record  ?record=<format>: the recorder seeks window.__loop frame by frame
   ========================================================================== */
(() => {
  const params = new URLSearchParams(location.search);
  const recordFormat = params.get('record');
  const root = document.documentElement;
  const RESUME_DELAY = 1500;       // ms the component stays live after the pointer leaves
  const RESUME_DELAY_TOUCH = 3000; // touch has no "leave", so wait longer after the last tap
  const RESIZE_DELAY = 150;

  const ARROW = '<svg class="loop-cursor__arrow" viewBox="0 0 24 24"><path d="M3 2v16.5l4.2-3.9 2.7 6.2 2.7-1.2-2.7-6.1h5.7z"/></svg>';
  const PAUSE = '<svg data-icon="pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const PLAY = '<svg data-icon="play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';

  function makeCursor(stage, kind) {
    const el = document.createElement('div');
    el.className = 'loop-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="loop-cursor__ring"></span>' +
      (kind === 'dot' ? '<span class="loop-cursor__dot"></span>' : ARROW);
    stage.append(el);
    return {
      el,
      body: el.lastElementChild,
      ring: el.firstElementChild,
      origin: kind === 'dot' ? '50% 50%' : '0 0',
    };
  }

  /* Cursor moves are written as tweens on the same timeline, so they seek
     with everything else. Targets: an element, a selector inside the stage,
     or a point { x, y } in stage pixels. */
  function cursorApi(tl, cursor, stage) {
    let presses = 0;
    const point = (target, ox = 0.5, oy = 0.5) => {
      if (typeof target !== 'string' && !(target instanceof Element)) return target;
      const node = typeof target === 'string' ? stage.querySelector(target) : target;
      const s = stage.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      return { x: r.left - s.left + r.width * ox, y: r.top - s.top + r.height * oy };
    };
    return {
      el: cursor.el,
      point,
      set(target, position = 0, { ox, oy } = {}) {
        tl.set(cursor.el, point(target, ox, oy), position);
      },
      move(target, position, { duration = 0.8, ease = 'power3.inOut', ox, oy } = {}) {
        tl.to(cursor.el, { ...point(target, ox, oy), duration, ease }, position);
      },
      press(position) {
        const at = `press${presses++}`;
        tl.addLabel(at, position)
          .to(cursor.body, { scale: 0.86, transformOrigin: cursor.origin, duration: 0.1, ease: 'power2.out' }, at)
          .to(cursor.body, { scale: 1, duration: 0.15, ease: 'power2.out' }, `${at}+=0.1`)
          .fromTo(cursor.ring,
            { scale: 0.4, opacity: 0.6 },
            { scale: 1.6, opacity: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, at);
      },
      show(position, duration = 0.2) {
        tl.to(cursor.el, { autoAlpha: 1, duration, ease: 'power2.out' }, position);
      },
      hide(position, duration = 0.2) {
        tl.to(cursor.el, { autoAlpha: 0, duration, ease: 'power2.in' }, position);
      },
    };
  }

  function makeControl(onToggle) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loop-control';
    btn.setAttribute('aria-label', 'Pause animation');
    btn.innerHTML = PAUSE + PLAY;
    btn.addEventListener('click', onToggle);
    document.body.append(btn);
    return btn;
  }

  function start({ build, rest = 0, cursor: cursorKind = 'arrow', fit, live, reset, frame, stage = document.querySelector('.stage') }) {
    const cursor = cursorKind ? makeCursor(stage, cursorKind) : null;
    const fitEl = fit ? stage.querySelector(fit) : null;
    let ctx;
    let tl;
    let paused = !recordFormat && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    let pointerInside = false;
    let resumeTimer;

    root.dataset.mode = recordFormat ? 'record' : 'demo';
    if (recordFormat) root.dataset.format = recordFormat;

    function create(at) {
      ctx = gsap.context(() => {
        tl = gsap.timeline({ paused: true, repeat: -1, defaults: { ease: 'power2.inOut' } });
        build(tl, cursor ? cursorApi(tl, cursor, stage) : null);
      }, stage);
      // Render once to the end and back, so every tween records its start
      // values in order and seeking to any frame shows the right state.
      tl.progress(1, true).progress(0, true).seek(at);
    }

    function sync() {
      const shouldPlay = root.dataset.mode === 'demo' && !paused && visible;
      if (shouldPlay) tl.play();
      else tl.pause();
    }

    function rebuild(at) {
      ctx.revert();
      create(at);
      sync();
    }

    function applyFit() {
      if (!fitEl) return;
      const pad = parseFloat(token('--gutter')) * 2;
      const scale = Math.min(
        1,
        (stage.clientWidth - pad) / fitEl.offsetWidth,
        (stage.clientHeight - pad) / fitEl.offsetHeight,
      );
      fitEl.style.scale = scale < 1 ? String(scale) : '';
    }

    document.fonts.ready.then(() => {
      applyFit();
      create(paused ? rest : 0);

      if (recordFormat) {
        window.__loop = {
          ready: true,
          duration: tl.duration() * 1000,
          seek(ms) {
            tl.seek(ms / 1000);
            if (frame) frame();
          },
        };
        return;
      }

      const control = makeControl(() => {
        paused = !paused;
        control.setAttribute('aria-pressed', String(paused));
        sync();
      });
      control.setAttribute('aria-pressed', String(paused));
      sync();

      // Hand the component to the visitor, and take it back when they leave
      const goLive = () => {
        clearTimeout(resumeTimer);
        if (root.dataset.mode === 'live') return;
        ctx.revert();
        root.dataset.mode = 'live';
        if (live) live();
      };
      const resumeLater = (delay) => {
        clearTimeout(resumeTimer);
        if (root.dataset.mode !== 'live') return;
        resumeTimer = setTimeout(() => {
          // Keyboard users keep the component until they tab away
          if (root.dataset.mode !== 'live' || pointerInside || stage.querySelector(':focus-visible')) return;
          if (stage.contains(document.activeElement)) document.activeElement.blur();
          if (reset) reset();
          root.dataset.mode = 'demo';
          create(paused ? rest : 0);
          sync();
        }, delay);
      };
      stage.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'touch') return;
        pointerInside = true;
        goLive();
      });
      stage.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        pointerInside = false;
        resumeLater(RESUME_DELAY);
      });
      stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') goLive(); });
      stage.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') resumeLater(RESUME_DELAY_TOUCH); });
      stage.addEventListener('focusin', goLive);
      stage.addEventListener('focusout', (e) => { if (!stage.contains(e.relatedTarget)) resumeLater(RESUME_DELAY); });

      // Stop drawing while the frame is scrolled out of view in the library
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (root.dataset.mode === 'demo') sync();
      }).observe(stage);

      let resizeTimer;
      addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          applyFit();
          if (root.dataset.mode !== 'live') rebuild(tl.time());
        }, RESIZE_DELAY);
      });
    });
  }

  // GSAP can't tween var(); read the token's resolved value instead
  const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  window.Loop = { start, token };
})();
