// Fills the token tables on design-system.html. Values are read live from
// css/tokens.css, so this page can never drift from what the site uses.
import { token } from './tokens.js';

const $ = (s) => document.querySelector(s);

const PRIMITIVE_COLORS = [
  '--neutral-0', '--neutral-100', '--neutral-200', '--neutral-500', '--neutral-600',
  '--neutral-700', '--neutral-800', '--neutral-900', '--neutral-950', '--neutral-1000',
  '--neutral-200-a10', '--neutral-200-a20', '--neutral-200-a32', '--neutral-200-a60',
  '--neutral-1000-a12', '--orange-500', '--blue-200',
];

// [semantic token, primitive it points to, where it is used]
const SEMANTIC_COLORS = {
  Surfaces: [
    ['--color-bg', '--neutral-1000', 'Page background, dark sections, menu, footer'],
    ['--color-bg-inverse', '--neutral-100', 'Light sections, section and page transitions'],
    ['--color-bg-placeholder', '--neutral-200', 'Image slot on light, before the image loads'],
    ['--color-bg-media', '--neutral-900', 'Image slot on dark, before the image loads'],
    ['--color-paper', '--neutral-0', 'Solid white chips: copy puck, skip link, header on light'],
  ],
  'Text on dark': [
    ['--color-text', '--neutral-200', 'Body copy and default text'],
    ['--color-text-strong', '--neutral-0', 'Titles, hover state of muted links, numbers'],
    ['--color-text-muted', '--neutral-200-a60', 'Secondary copy, labels, idle links'],
    ['--color-text-subtle', '--neutral-200-a32', 'Hover on the big email link'],
    ['--color-text-faint', '--neutral-200-a10', 'About title before it lights up on scroll'],
  ],
  'Text on light': [
    ['--color-text-inverse', '--neutral-700', 'Body copy on light sections'],
    ['--color-text-inverse-strong', '--neutral-800', 'Numbers and big words on light'],
    ['--color-text-inverse-muted', '--neutral-600', 'Labels and meta on light'],
    ['--color-on-paper', '--neutral-1000', 'Text and icons on white chips'],
  ],
  'Lines and accent': [
    ['--color-border', '--neutral-200-a20', 'Hairlines on dark'],
    ['--color-border-inverse', '--neutral-1000-a12', 'Hairlines on light'],
    ['--color-accent', '--orange-500', 'Underline sweep, active strings, the 3D rims'],
    ['--color-focus', '--orange-500', 'Keyboard focus ring'],
    ['--color-mark-idle', '--neutral-800', 'Empty logo in the preloader'],
  ],
  'Canvas and 3D (read from JS)': [
    ['--color-string', '--neutral-200', 'Hero and footer strings at rest'],
    ['--color-string-active', '--orange-500', 'String glow when touched, comet tail'],
    ['--color-comet', '--neutral-0', 'Comet head'],
    ['--color-orbit', '--neutral-500', 'Orbit lines around the spiral'],
    ['--color-scene-body', '--neutral-950', '3D logo material'],
    ['--color-scene-edge', '--neutral-200', '3D logo wireframe during the intro'],
    ['--color-scene-key', '--neutral-0', 'Key and ambient light'],
    ['--color-scene-rim', '--orange-500', 'Rim lights'],
    ['--color-scene-fill', '--blue-200', 'Cool fill light'],
  ],
};

const TYPE_STYLES = [
  // [name, class for the sample, size token, line height, tracking, use]
  ['Menu', 'display', '--fs-menu', '--lh-display', '--ls-display', 'Menu overlay links'],
  ['Hero', 'display', '--fs-hero', '--lh-hero', '--ls-display', 'Home hero title'],
  ['Title', 'display', '--fs-title', '--lh-display', '--ls-display', 'Case study title, next project'],
  ['Contact', 'display', '--fs-contact', '--lh-display', '--ls-display', 'Footer "Say hello at"'],
  ['Heading', 'display', '--fs-heading', '--lh-display', '--ls-display', 'Section headings'],
  ['Industry', 'display', '--fs-industry', '--lh-stack', '--ls-display', 'Stacked words behind the spiral'],
  ['Impact', 'display', '--fs-impact', '--lh-none', '--ls-impact', 'Big numbers on case studies'],
  ['Transition', 'display', '--fs-transition', '--lh-display', '--ls-display', 'Page name during the page transition'],
  ['Card title', 'heading', '--fs-card-title', '--lh-none', '--ls-heading', 'Work card title'],
  ['Subheading', 'heading', '--fs-subheading', '--lh-heading', '--ls-heading', 'Decision titles, block subheads'],
  ['Metric', 'heading', '--fs-metric', '--lh-none', '--ls-heading', 'Numbers on work cards'],
  ['Lead', '', '--fs-lead', '--lh-reading', '', 'Case study body copy and lists'],
  ['Body large', '', '--fs-body-lg', '--lh-note', '', 'Logo word, short notes'],
  ['Body', '', '--fs-body', '--lh-body', '', 'Default text'],
  ['Body small', '', '--fs-body-sm', '--lh-body', '', 'Tags, card tags'],
  ['Caps', 'caps', '--fs-caps', '--lh-none', '--ls-caps', 'Labels, pills, kicker'],
  ['Mono', 'mono', '--fs-mono', '--lh-body', '--ls-mono', 'Link buttons, eyebrows, meta'],
  ['Label', 'caps', '--fs-label', '--lh-none', '--ls-caps', 'Case study section labels'],
  ['Caption', 'mono', '--fs-caption', '--lh-body', '--ls-mono', 'Footer bar, stat box, trade-off label'],
  ['Micro', 'mono', '--fs-micro', '--lh-label', '--ls-mono', 'Metric labels on work cards'],
];

const SPACES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 14, 16, 18, 20, 25, 30, 35, 45];

const MOTION = [
  ['--dur-fast', '--duration-150', 'Color changes on small links'],
  ['--dur-fade', '--duration-200', 'Copy puck fade'],
  ['--dur-pop', '--duration-250', 'Copy puck scale'],
  ['--dur', '--duration-300', 'Default UI transition'],
  ['--dur-loop', '--duration-1800', 'Scroll cue loop'],
  ['--ease', '--easing-in-out', 'Default easing'],
  ['--ease-out', '--easing-out', 'Things that pop in'],
  ['--opacity-pressed', '--opacity-70', 'Active (pressed) state'],
  ['--opacity-disabled', '--opacity-40', 'Disabled state'],
  ['--blur-reveal', '--blur-12', 'Text sharpens in from this blur'],
];

const LAYERS = [
  ['--z-lines', 'Hero strings canvas'], ['--z-scene', '3D canvas'], ['--z-content', 'Main content'],
  ['--z-stack-1', 'Local stacking, level 1'], ['--z-stack-2', 'Local stacking, level 2'], ['--z-stack-3', 'Local stacking, level 3'],
  ['--z-overlay', 'Strips closing over a section'], ['--z-menu', 'Menu overlay'], ['--z-header', 'Fixed header'],
  ['--z-preloader', 'Preloader'], ['--z-skip', 'Skip link'], ['--z-cursor', 'Copy puck'],
  ['--z-transition-cover', 'Cover before the page script runs'], ['--z-transition', 'Page transition belts'],
];

const code = (t) => `<code>${t}</code>`;
const dot = (t) => `<span class="ds-dot" style="--swatch: var(${t})" aria-hidden="true"></span>`;

function table(head, rows) {
  return `<div class="ds-scroll"><table class="ds-table"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

$('[data-primitive-colors]').innerHTML = PRIMITIVE_COLORS.map((t) => `
  <div class="ds-swatch">
    <span class="ds-swatch__chip" style="--swatch: var(${t})" aria-hidden="true"></span>
    <span class="ds-code">${t}</span>
    <span class="ds-code">${token(t)}</span>
  </div>`).join('');

$('[data-semantic-colors]').innerHTML = Object.entries(SEMANTIC_COLORS).map(([group, rows]) => `
  <div class="ds-group">
    <h4 class="ds-group__title caps">${group}</h4>
    ${table(['', 'Semantic token', 'Primitive', 'Value', 'Use'], rows.map(([t, p, use]) => [dot(t), code(t), code(p), code(token(t)), use]))}
  </div>`).join('');

$('[data-type-styles]').innerHTML = TYPE_STYLES.map(([name, cls, size, lh, ls, use]) => `
  <div class="ds-type__row">
    <div class="ds-type__meta">
      <span class="caps">${name}</span>
      <span class="ds-code">${[cls && `.${cls}`, size, lh, ls].filter(Boolean).join(' · ')}</span>
      <span class="ds-code">${token(size)}</span>
      <span class="ds-text">${use}</span>
    </div>
    <p class="ds-type__sample ${cls}" style="font-size: var(${size}); line-height: var(${lh});${ls ? ` letter-spacing: var(${ls});` : ''}">Crafting products</p>
  </div>`).join('');

$('[data-spaces]').innerHTML = SPACES.map((n) => `
  <div class="ds-space__row">
    <span class="ds-code">--space-${n} · ${token(`--space-${n}`)}</span>
    <span class="ds-space__bar" style="--bar: var(--space-${n})" aria-hidden="true"></span>
  </div>`).join('');

$('[data-motion]').innerHTML = table(['Semantic token', 'Primitive', 'Value', 'Use'],
  MOTION.map(([t, p, use]) => [code(t), code(p), code(token(t)), use]));

$('[data-layers]').innerHTML = table(['Token', 'Value', 'Use'],
  LAYERS.map(([t, use]) => [code(t), code(token(t)), use]));
