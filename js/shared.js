// Pieces used by every page: smooth scroll, menu, anchors and the footer.
import { createLines } from './lines.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function initSmoothScroll(reducedMotion) {
  if (reducedMotion) return null;
  const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  return words.map((w, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.style.display = 'inline-block';
    span.textContent = w;
    el.append(span);
    if (i < words.length - 1) el.append(' ');
    return span;
  });
}

export function initMenu(lenis) {
  const menu = $('#menu');
  const menuToggle = $('[data-menu-toggle]');
  const menuLabel = $('[data-menu-label]');
  if (!menu || !menuToggle) return;

  function setMenu(open) {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      lenis?.stop();
      $('a', menu).focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      lenis?.start();
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 300);
    }
  }
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  $$('[data-menu-link]').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuToggle.focus();
    }
  });
}

// Anchor links go through Lenis so they glide
export function initAnchors(lenis) {
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.4 });
  }));
}

export function initFooter(reducedMotion) {
  const footer = $('.footer');
  if (!footer) return;

  createLines($('.footer__lines'), { reducedMotion });

  if (!reducedMotion) {
    gsap.set('.footer__line', { yPercent: 108 });
    gsap.set('.footer__email-line', { opacity: 0, y: 24 });
    gsap.timeline({ scrollTrigger: { trigger: footer, start: 'top 60%' } })
      .to('.footer__line', { yPercent: 0, duration: 0.8, ease: 'expo.out' })
      .to('.footer__email-line', { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.2);
  }

  const emailBtn = $('[data-copy-email]');
  const copyStatus = $('[data-copy-status]');
  const puck = $('.copy-puck');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  emailBtn.addEventListener('click', () => {
    const email = emailBtn.dataset.copyEmail;
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = email;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* nothing else to try */ }
      ta.remove();
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email).catch(fallback);
    else fallback();

    copyStatus.textContent = 'Email copied';
    emailBtn.classList.add('is-copied');
    puck.classList.add('is-copied');
    clearTimeout(emailBtn._t);
    emailBtn._t = setTimeout(() => {
      emailBtn.classList.remove('is-copied');
      puck.classList.remove('is-copied');
      copyStatus.textContent = '';
    }, 1800);
  });

  const lastPointer = { x: -1, y: -1 };
  emailBtn.addEventListener('pointerenter', () => { if (finePointer.matches) puck.classList.add('is-visible'); });
  emailBtn.addEventListener('pointerleave', () => puck.classList.remove('is-visible', 'is-copied'));
  emailBtn.addEventListener('pointermove', (e) => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    const half = puck.offsetWidth / 2; // keeps the puck centred on the cursor at any size
    puck.style.transform = `translate3d(${e.clientX - half}px, ${e.clientY - half}px, 0)`;
  });
  // Scrolling moves the email away without firing pointerleave; hide the puck then
  window.addEventListener('scroll', () => {
    if (!puck.classList.contains('is-visible')) return;
    const under = document.elementFromPoint(lastPointer.x, lastPointer.y);
    if (!under || !emailBtn.contains(under)) puck.classList.remove('is-visible', 'is-copied');
  }, { passive: true });
}

/* ---------- Page transition ----------
   Leaving: ten equal belts close over the page and the next page's name
   appears in the middle. Arriving: the new page starts covered and the
   belts open again. The flag in sessionStorage tells the next page to
   start covered (an inline script in <head> sets html.is-shifting early). */
const SHIFT_KEY = 'page-shift';
const BELTS = 10;

function buildShift() {
  const el = document.createElement('div');
  el.className = 'page-shift';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="page-shift__belts">${'<i class="page-shift__belt"></i>'.repeat(BELTS)}</div>
    <div class="page-shift__label">
      <svg class="page-shift__mark" viewBox="0 0 27 26.7773"><use href="#logo-mark"/></svg>
      <span class="page-shift__title display"></span>
    </div>`;
  document.body.append(el);
  return el;
}

function isInternal(a, e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download')) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  // same page, only the hash changes: let the anchor scroll handle it
  if (url.pathname === location.pathname && url.hash) return false;
  return true;
}

export function initPageTransitions(reducedMotion) {
  const root = document.documentElement;
  const arriving = root.classList.contains('is-shifting');
  let label = '';
  try { label = sessionStorage.getItem(SHIFT_KEY) || ''; sessionStorage.removeItem(SHIFT_KEY); } catch (err) { /* storage blocked */ }

  if (reducedMotion) {
    root.classList.remove('is-shifting');
    return { entered: Promise.resolve() };
  }

  const shift = buildShift();
  const belts = [...shift.querySelectorAll('.page-shift__belt')];
  const labelEl = shift.querySelector('.page-shift__label');
  const titleEl = shift.querySelector('.page-shift__title');

  // Arriving: start covered, then open
  const entered = new Promise((resolve) => {
    if (!arriving) { resolve(); return; }
    titleEl.textContent = label;
    gsap.set(belts, { scaleY: 1, transformOrigin: '50% 0%' });
    gsap.set(labelEl, { opacity: 1 });
    root.classList.remove('is-shifting');
    shift.classList.add('is-active');
    const open = () => gsap.timeline({ onComplete: () => { shift.classList.remove('is-active'); resolve(); } })
      .to(labelEl, { opacity: 0, y: -16, duration: 0.3, ease: 'power2.in' }, 0.15)
      .to(belts, { scaleY: 0, duration: 0.7, ease: 'power3.inOut', stagger: 0.045 }, 0.3);
    document.fonts.ready.then(open);
  });

  // Leaving: close, then navigate
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !isInternal(a, e)) return;
    e.preventDefault();
    const name = a.dataset.transitionLabel || a.textContent.trim().replace(/\s+/g, ' ');
    try { sessionStorage.setItem(SHIFT_KEY, name); } catch (err) { /* storage blocked: still navigates */ }
    titleEl.textContent = name;
    shift.classList.add('is-active');
    gsap.set(belts, { scaleY: 0, transformOrigin: '50% 100%' });
    gsap.set(labelEl, { opacity: 0, y: 16 });
    gsap.timeline({ onComplete: () => { location.href = a.href; } })
      .to(belts, { scaleY: 1, duration: 0.7, ease: 'power3.inOut', stagger: 0.045 })
      .to(labelEl, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, '-=0.3')
      .to({}, { duration: 0.15 });
  });

  // Back/forward cache restores the page as we left it (covered): open it
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.set(belts, { scaleY: 0 });
    gsap.set(labelEl, { opacity: 0 });
    shift.classList.remove('is-active');
  });

  return { entered };
}
