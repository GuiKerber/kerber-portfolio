import { createScene } from './scene.js';
import { createLines } from './lines.js';
import { createSpiral } from './spiral.js';
import { initSmoothScroll, splitWords, initMenu, initAnchors, initFooter, initPageTransitions } from './shared.js';
import { token } from './tokens.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLUR = `blur(${token('--blur-reveal')})`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Smooth scroll ---------- */
const lenis = initSmoothScroll(reducedMotion);
lenis?.stop();

/* ---------- Page transition (arriving from a case study skips the preloader) ---------- */
const arrivedByShift = document.documentElement.classList.contains('is-shifting');
const { entered } = initPageTransitions(reducedMotion);

/* ---------- Text splitting ---------- */
function splitChars(el) {
  const label = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', label);
  const chars = [];
  [...el.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const frag = document.createDocumentFragment();
    node.textContent.trim().split(/\s+/).forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.style.whiteSpace = 'nowrap';
      w.setAttribute('aria-hidden', 'true');
      [...word].forEach((ch) => {
        const c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        w.append(c);
        chars.push(c);
      });
      frag.append(w);
      if (i < arr.length - 1) frag.append(' ');
    });
    node.replaceWith(frag);
  });
  return chars;
}

/* ---------- Scene + lines ---------- */
const scene = createScene($('.webgl'), { reducedMotion });
const lines = createLines($('.lines-canvas'), { reducedMotion });

window.addEventListener('pointermove', (e) => {
  scene.setMouse((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

const hero = $('.hero');

initMenu(lenis);
initAnchors(lenis);

/* ---------- Hero word rotator ---------- */
function startRotator() {
  const words = $$('.hero__word');
  if (reducedMotion || words.length < 2) return;
  let i = 0;
  gsap.set(words, { yPercent: 0 });
  setInterval(() => {
    const cur = words[i];
    i = (i + 1) % words.length;
    const next = words[i];
    gsap.to(cur, { opacity: 0, filter: BLUR, yPercent: -20, duration: 0.3, ease: 'power2.in' });
    gsap.fromTo(next,
      { opacity: 0, filter: BLUR, yPercent: 20 },
      { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 0.3, delay: 0.15, ease: 'power2.out' });
  }, 2600);
}

/* ---------- Reveal helpers ---------- */
const blurTargets = $$('[data-blur-in]').map((el) => ({ el, words: splitWords(el) }));
const heroBlur = blurTargets.filter(({ el }) => hero.contains(el));
const pageBlur = blurTargets.filter(({ el }) => !hero.contains(el));
const heroFade = $$('[data-fade-up]', hero);
const pageFade = $$('[data-fade-up]').filter((el) => !hero.contains(el));

if (!reducedMotion) {
  gsap.set(heroBlur.flatMap((b) => b.words), { opacity: 0, filter: BLUR });
  gsap.set('.hero__word.is-active', { opacity: 0, filter: BLUR });
  gsap.set(heroFade, { opacity: 0, y: 24 });

  pageBlur.forEach(({ el, words }) => {
    gsap.from(words, {
      opacity: 0, filter: BLUR, duration: 0.9, stagger: 0.06, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
  pageFade.forEach((el) => {
    gsap.from(el, {
      opacity: 0, y: 32, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  // About title: characters light up as you scroll
  $$('[data-scrub-chars]').forEach((el) => {
    const chars = splitChars(el);
    gsap.to(chars, {
      color: token('--color-text'),
      stagger: 0.02,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: 0.6 },
    });
  });
} else {
  $$('[data-scrub-chars]').forEach(splitChars);
}

function playHeroIntro() {
  scene.playIntro();
  if (reducedMotion) { startRotator(); return; }
  const tl = gsap.timeline({ delay: 0.35 });
  tl.to(heroBlur.flatMap((b) => b.words), { opacity: 1, filter: 'blur(0px)', duration: 1, stagger: 0.09, ease: 'power2.out' })
    .to('.hero__word.is-active', { opacity: 1, filter: 'blur(0px)', duration: 1, ease: 'power2.out' }, '-=0.75')
    .to(heroFade, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, '-=0.6')
    .add(startRotator);
}

/* ---------- Scroll-linked 3D + lines ---------- */
ScrollTrigger.create({
  trigger: hero,
  start: 'top top',
  end: 'bottom top',
  scrub: true,
  onUpdate: (self) => {
    scene.setScroll(self.progress);
    lines.setOpacity(1 - self.progress);
  },
});
// Shards keep drifting behind the about text, dimmed so it stays readable
ScrollTrigger.create({
  trigger: '.about',
  start: 'top bottom',
  end: 'bottom top',
  onUpdate: (self) => scene.setOpacity(1 - self.progress * 0.5),
});

/* ---------- Dark -> light: strips grow until they cover the screen ---------- */
const STRIPS = [
  // [top %, height %, grow origin %]
  [0, 7, 100], [7, 9, 0], [16, 4, 50], [20, 14, 100], [34, 8, 0],
  [42, 12, 50], [54, 6, 100], [60, 15, 0], [75, 9, 50], [84, 16, 100],
];
const STRIP_ORDER = [3, 7, 0, 5, 9, 1, 6, 2, 8, 4];
function buildStrips(container) {
  return STRIPS.map(([top, h, o]) => {
    const el = document.createElement('i');
    el.className = 'shift__strip';
    el.style.setProperty('--top', `${top}%`);
    el.style.setProperty('--h', `${h}%`);
    el.style.setProperty('--o', `${o}%`);
    container.append(el);
    return el;
  });
}
// Adds the strip growth to a timeline; the whole growth lasts `duration`
function addStrips(tl, strips, at = 0, duration = 2.08) {
  const k = duration / 2.08;
  STRIP_ORDER.forEach((idx, i) => {
    tl.to(strips[idx], { scaleY: 1, ease: 'power2.inOut', duration: k }, at + i * 0.12 * k);
  });
}

const shiftSticky = $('.shift__sticky');
const strips = buildStrips(shiftSticky);
// Header turns dark while the light sections sit under it
const theme = { light: false, footer: false };
function updateTheme() {
  document.body.classList.toggle('theme-light', theme.light && !theme.footer);
}

// Strips grow behind the work section while it rises from the bottom;
// by the time it reaches the top they have filled the dark area above it.
const shiftTl = gsap.timeline({
  scrollTrigger: {
    trigger: '.shift',
    start: 'top 70%',
    endTrigger: '.work',
    end: 'top top',
    scrub: true,
    onUpdate: (self) => {
      scene.setOpacity(0.5 * (1 - self.progress));
      theme.light = self.progress > 0.55;
      updateTheme();
    },
    onToggle: (self) => { shiftSticky.style.visibility = self.isActive ? 'visible' : 'hidden'; },
  },
});
addStrips(shiftTl, strips);

// Dark strips that close the light sections before the footer
const outStrips = buildStrips($('.shift-out'));
function onOutProgress(p) {
  theme.footer = p > 0.85;
  updateTheme();
}

/* ---------- Selected work: horizontal track + industries spiral ---------- */
const spiral = createSpiral($('.spiral'), [
  'origo-synthetic-user-interview-tool', 'ai-tool-for-connecting-smart-npcs-to-real-ga',
  'ai-agent-desk-for-photographers', 'chess-app', 'gamercraft-careers-page',
  'web3-landing-page-concept', 'novos-training-board', 'space-travel',
  'koncepted-landing-page',
  'gamecenter-app-gamercraft', 'twire-esports-insights',
  'metaverse-map', 'gaming-ar-interface',
].map((name) => `assets/dribbble/${name}.webp`), { reducedMotion });

const work = $('.work');
const track = $('.work__track');
const industries = $('.industries');
const cardImages = $$('.work-card__media img');

if (!reducedMotion) {
  $$('[data-blur-chars]').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    const chars = $$('.line', el).flatMap((line) => {
      const text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      return [...text].map((ch) => {
        const c = document.createElement('span');
        c.textContent = ch;
        c.style.display = 'inline-block';
        if (ch === ' ') c.style.width = '0.25em';
        line.append(c);
        return c;
      });
    });
    gsap.from(chars, {
      opacity: 0, filter: BLUR, duration: 0.9, ease: 'power2.out',
      stagger: { each: 0.03, from: 'random' },
      scrollTrigger: { trigger: work, start: 'top 55%' },
    });
  });
}

const mm = gsap.matchMedia();
mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
  const trackDistance = () => track.scrollWidth - window.innerWidth;
  gsap.to(track, {
    x: () => -trackDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: work,
      start: 'top top',
      end: () => `+=${trackDistance()}`,
      pin: '.work__pin',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: () => {
        const vw = window.innerWidth;
        cardImages.forEach((img) => {
          const r = img.parentElement.getBoundingClientRect();
          const c = (r.left + r.width / 2 - vw / 2) / vw;
          img.style.transform = `translateX(${c * -8}%) scale(1.12)`;
        });
      },
    },
  });
  return () => gsap.set(track, { clearProps: 'transform' });
});

/* ---------- Industries: lines slide in, spiral runs, dark strips close ---------- */
if (!reducedMotion) {
  const wordLines = $$('.industries__words li');
  // alternate sides: the first line comes from the left, the next from the right...
  wordLines.forEach((li, i) => {
    const dir = i % 2 === 0 ? -1 : 1;
    gsap.fromTo(li, { x: () => dir * window.innerWidth * 0.55 }, {
      x: 0,
      ease: 'none',
      scrollTrigger: { trigger: industries, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true },
    });
  });

  const spiralState = { p: 0 };
  const outState = { p: 0 };
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: industries,
      start: 'top top',
      end: () => `+=${window.innerHeight * 4}`,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
  tl.to(spiralState, { p: 1, ease: 'none', duration: 3, onUpdate: () => spiral.setProgress(spiralState.p) })
    // keep the lines drifting apart a little while the spiral passes
    .to(wordLines, { xPercent: (i) => (i % 2 === 0 ? 6 : -6), ease: 'none', duration: 3 }, 0)
    .to(outState, { p: 1, ease: 'none', duration: 1, onUpdate: () => onOutProgress(outState.p) }, 3);
  addStrips(tl, outStrips, 3, 1);
}

/* ---------- Footer: title reveal, copy email, strings ---------- */
initFooter(reducedMotion);

/* ---------- Preloader ---------- */
const counter = { v: 0 };
const countEl = $('[data-count]');
const fill = $('.preloader__fill');
const ready = Promise.all([document.fonts.ready, new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })))]);

const loadTween = gsap.to(counter, {
  v: 90,
  duration: reducedMotion ? 0.2 : 1.6,
  ease: 'power2.out',
  onUpdate: () => {
    const v = Math.round(counter.v);
    countEl.textContent = v;
    fill.style.clipPath = `inset(${100 - v}% 0 0 0)`;
  },
});

if (arrivedByShift) {
  loadTween.kill();
  $('.preloader').remove();
  document.body.classList.remove('is-loading');
  lenis?.start();
  ScrollTrigger.refresh();
  entered.then(() => {
    playHeroIntro();
    // links like ../#work from a case page land on that section
    const target = location.hash && $(location.hash);
    if (target) lenis ? lenis.scrollTo(target, { duration: 1.4 }) : target.scrollIntoView();
  });
} else ready.then(() => {
  loadTween.then(() => {
    gsap.timeline()
      .to(counter, {
        v: 100, duration: 0.4, ease: 'power1.out',
        onUpdate: () => {
          const v = Math.round(counter.v);
          countEl.textContent = v;
          fill.style.clipPath = `inset(${100 - v}% 0 0 0)`;
        },
      })
      .to('.preloader', { clipPath: 'inset(0 0 100% 0)', duration: reducedMotion ? 0.01 : 0.9, ease: 'expo.inOut' }, '+=0.15')
      .add(() => {
        $('.preloader').remove();
        document.body.classList.remove('is-loading');
        lenis?.start();
        ScrollTrigger.refresh();
        playHeroIntro();
      }, '-=0.35');
  });
});
