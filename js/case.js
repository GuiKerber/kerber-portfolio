import { initSmoothScroll, splitWords, initMenu, initAnchors, initFooter, initPageTransitions } from './shared.js';
import { token } from './tokens.js';

const { gsap } = window;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLUR = `blur(${token('--blur-reveal')})`;
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const lenis = initSmoothScroll(reducedMotion);
initMenu(lenis);
initAnchors(lenis);
initFooter(reducedMotion);
const { entered } = initPageTransitions(reducedMotion);

if (!reducedMotion) {
  // Title: words sharpen in once the page is uncovered
  $$('[data-blur-in]').forEach((el) => {
    const words = splitWords(el);
    gsap.set(words, { opacity: 0, filter: BLUR });
    entered.then(() => gsap.to(words, {
      opacity: 1, filter: 'blur(0px)', duration: 1, stagger: 0.08, ease: 'power2.out', delay: 0.05,
    }));
  });

  // Text and numbers rise in as they enter
  $$('[data-fade-up]').forEach((el) => {
    gsap.from(el, {
      opacity: 0, y: 32, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  // Images open from the bottom edge. No zoom: the shots are framed compositions
  $$('[data-reveal]').forEach((block) => {
    const figures = block.matches('figure') ? [block] : $$('figure', block);
    figures.forEach((fig, i) => {
      gsap.fromTo(fig, { clipPath: 'inset(18% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', delay: i * 0.08,
        scrollTrigger: { trigger: fig, start: 'top 88%' },
      });
    });
  });
}
