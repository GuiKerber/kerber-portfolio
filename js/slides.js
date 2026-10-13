// Slide deck: one slide at a time. Arrow keys, space, the buttons or a swipe
// move between slides; #number in the address opens that slide.
// Transition: the current slide lifts away, the background crossfades to the
// next slide's theme, then its pieces come in one after another.
import { createLines } from './lines.js';
import { token } from './tokens.js';

const { gsap } = window;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLUR = `blur(${token('--blur-reveal')})`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const deck = $('.deck');
const slides = $$('.slide');
const total = slides.length;
const ui = {
  prev: $('[data-deck-prev]'),
  next: $('[data-deck-next]'),
  full: $('[data-deck-full]'),
  count: $('[data-deck-count]'),
  chapter: $('[data-deck-chapter]'),
  progress: $('[data-deck-progress]'),
  status: $('[data-deck-status]'),
};
const pad = (n) => String(n).padStart(2, '0');

slides.forEach((slide, i) => slide.setAttribute('aria-label', `${i + 1} of ${total}: ${slide.getAttribute('aria-label')}`));

// Splits the text of an element into word spans, keeping inner tags (like a muted second sentence)
function splitWords(el) {
  const words = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) { walk(child); return; }
      if (child.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = part;
        frag.append(span);
        words.push(span);
      });
      child.replaceWith(frag);
    });
  };
  walk(el);
  return words;
}

// How each kind of piece comes in
const ENTER = {
  // titles: words sharpen in from the blur, like the rest of the site
  words(el) {
    el._words ??= splitWords(el);
    return gsap.fromTo(el._words, { opacity: 0, filter: BLUR }, { opacity: 1, filter: 'blur(0px)', duration: 0.8, stagger: 0.05, ease: 'power2.out' });
  },
  up: (el) => gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }),
  // images open from the bottom edge, never zoomed
  clip: (el) => gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.out' }),
  // timeline bars and lines draw from the left
  wipe: (el) => gsap.fromTo(el, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.out' }),
};

function countUp(el) {
  const to = Number(el.textContent);
  const from = Number(el.dataset.from || 0);
  const value = { n: from };
  el.textContent = from;
  return gsap.to(value, { n: to, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(value.n); } });
}

function enter(slide) {
  const tl = gsap.timeline();
  $$('[data-in]', slide).forEach((el, i) => tl.add(ENTER[el.dataset.in](el), i * 0.07));
  $$('[data-count]', slide).forEach((el) => tl.add(countUp(el), 0.2));
  return tl;
}

// Strings behind the cover and the closing slide
const lines = createLines($('.deck__lines'), { reducedMotion });
const linesOpacity = { o: 0 };
function showLines(on) {
  if (reducedMotion) { lines.setOpacity(on ? 1 : 0); return; }
  gsap.to(linesOpacity, { o: on ? 1 : 0, duration: 0.6, ease: 'power2.out', onUpdate: () => lines.setOpacity(linesOpacity.o) });
}

// A slide taller than the screen scrolls; the edges fade while there is more above or below
function updateMore(slide) {
  const more = slide.scrollHeight - slide.clientHeight - slide.scrollTop > 1;
  slide.classList.toggle('has-more', more);
  slide.classList.toggle('has-before', slide.scrollTop > 1);
}
slides.forEach((slide) => slide.addEventListener('scroll', () => updateMore(slide), { passive: true }));
window.addEventListener('resize', () => updateMore(slides[index]));

let index = -1;
let tl = null;

function show(slide) {
  slides.forEach((s) => { s.hidden = s !== slide; });
  slide.scrollTop = 0;
  deck.dataset.theme = slide.dataset.theme;
  updateMore(slide);
}

function updateChrome() {
  const slide = slides[index];
  ui.count.textContent = `${pad(index + 1)} / ${pad(total)}`;
  ui.chapter.textContent = slide.dataset.chapter;
  ui.progress.style.transform = `scaleX(${(index + 1) / total})`;
  ui.prev.setAttribute('aria-disabled', String(index === 0));
  ui.next.setAttribute('aria-disabled', String(index === total - 1));
  ui.status.textContent = slide.getAttribute('aria-label');
  history.replaceState(null, '', `#${index + 1}`);
}

function go(to) {
  to = Math.max(0, Math.min(total - 1, to));
  if (to === index) return;
  const from = slides[index];
  const next = slides[to];
  const dir = to > index ? 1 : -1;
  index = to;
  updateChrome();

  // A new move finishes the running one at once, so fast clicking never stacks up
  tl?.progress(1).kill();

  if (reducedMotion || !from) {
    show(next);
    showLines(next.hasAttribute('data-lines'));
    tl = reducedMotion ? null : enter(next);
    return;
  }

  const inner = $('.slide__inner', from);
  tl = gsap.timeline()
    .to(inner, { opacity: 0, y: -24 * dir, duration: 0.3, ease: 'power2.in' })
    .call(() => {
      gsap.set(inner, { clearProps: 'opacity,transform' });
      show(next);
      showLines(next.hasAttribute('data-lines'));
    })
    .add(enter(next), '+=0.12'); // the background crossfade (--dur) gets a head start
}

const step = (d) => go(index + d);
ui.prev.addEventListener('click', () => step(-1));
ui.next.addEventListener('click', () => step(1));

document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  // Space and Enter keep their normal job on a focused button or link
  const onControl = e.target.closest('a, button');
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': step(1); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': step(-1); break;
    case ' ': if (onControl) return; step(e.shiftKey ? -1 : 1); break;
    case 'Home': go(0); break;
    case 'End': go(total - 1); break;
    case 'f': case 'F': toggleFullscreen(); break;
    default: return;
  }
  e.preventDefault();
});

// Swipe left or right on touch screens
let touch = null;
deck.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY }; });
deck.addEventListener('pointerup', (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x;
  const dy = e.clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
});
deck.addEventListener('pointercancel', () => { touch = null; });

// Full screen, where the browser allows it
function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => { /* refused: stay windowed */ });
}
if (document.fullscreenEnabled) {
  ui.full.hidden = false;
  ui.full.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const on = Boolean(document.fullscreenElement);
    ui.full.setAttribute('aria-pressed', String(on));
    ui.full.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
    ui.full.title = on ? 'Exit full screen (F)' : 'Full screen (F)';
  });
}

// #number opens that slide
const fromHash = () => Number(location.hash.slice(1)) - 1;
window.addEventListener('hashchange', () => { const n = fromHash(); if (n >= 0) go(n); });

// Hide every slide until the fonts are in, so the first titles don't split twice
slides.forEach((s) => { s.hidden = true; });
document.fonts.ready.then(() => go(fromHash() >= 0 ? fromHash() : 0));
