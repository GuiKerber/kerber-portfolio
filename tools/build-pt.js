/* Builds the Portuguese site under /pt/ from the English pages.
   ---------------------------------------------------------------------
   Run it from the project root whenever page content changes:

       node tools/build-pt.js

   The English pages are the source of truth. Every translatable string
   carries its Portuguese next to it — data-pt for text, data-pt-alt for
   image alt text, data-pt-label for aria-label, data-pt-href for links.
   This script applies those, drops the attributes, fixes the asset paths
   for the extra folder depth, and writes the result into /pt/.
   Nothing under /pt/ should ever be edited by hand: it is overwritten. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://guikerber.com';

/* Each page, with the head strings that only exist in Portuguese. */
const PAGES = [
  {
    src: 'index.html', dir: '',
    title: 'Guilherme Kerber · Product Designer',
    desc: 'Product Designer sênior com mais de 15 anos criando produtos digitais que equilibram clareza, estratégia e qualidade visual. Do Brasil para o mundo.',
    ogDesc: 'Product Designer sênior com mais de 15 anos criando produtos digitais que equilibram clareza, estratégia e qualidade visual.',
  },
  {
    src: 'ai-front-desk/index.html', dir: 'ai-front-desk/',
    title: 'Assistente de IA para Fotógrafos',
    desc: 'Um agente de IA que lê as mensagens recebidas, negocia no tom de voz e na tabela de preços do próprio fotógrafo, e agenda sessões confirmadas direto no calendário.',
  },
  {
    src: 'staking-marketplace/index.html', dir: 'staking-marketplace/',
    title: 'Marketplace de Staking em BTC',
    desc: 'Um mercado de lances para stake delegado, integrado a uma carteira cripto multi-chain. Delegadores publicam o que possuem e operadores de nó fazem lances com termos de comissão.',
  },
  {
    src: 'cross-platform-coaching/index.html', dir: 'cross-platform-coaching/',
    title: 'Experiência de Coaching Multiplataforma',
    desc: 'Redesign de desktop e MVP mobile para uma plataforma de coaching fitness remoto, conectando treinadores e alunos quando as sessões presenciais deixaram de ser possíveis.',
  },
];

const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'line', 'use']);

/* Finds where the element opened at `openEnd` closes, counting nested tags
   of the same name so an inner <span> never ends an outer one. */
function closeOf(html, tag, openEnd) {
  const open = new RegExp('<' + tag + '(?=[\\s/>])', 'gi');
  const close = new RegExp('</' + tag + '\\s*>', 'gi');
  let depth = 1, i = openEnd;
  for (;;) {
    open.lastIndex = i; close.lastIndex = i;
    const o = open.exec(html), c = close.exec(html);
    if (!c) return -1;
    if (o && o.index < c.index) { depth++; i = o.index + 1; continue; }
    depth--;
    if (depth === 0) return c.index;
    i = c.index + 1;
  }
}

/* Swaps every [data-pt] element's contents for its Portuguese, back to
   front so the offsets ahead of each edit stay valid. */
function applyText(html, report) {
  const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\sdata-pt="([^"]*)"([^>]*)>/g;
  const hits = [];
  let m;
  while ((m = re.exec(html))) {
    const [full, tag, before, pt, after] = m;
    if (VOID.has(tag.toLowerCase())) { report.push('data-pt em tag vazia <' + tag + '>'); continue; }
    const openEnd = m.index + full.length;
    const end = closeOf(html, tag, openEnd);
    if (end < 0) { report.push('sem fechamento para <' + tag + '> com data-pt'); continue; }
    hits.push({ start: m.index, openEnd, end, tag, before, after, pt });
  }
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    const inner = html.slice(h.openEnd, h.end);
    if (/\sdata-pt="/.test(inner)) { report.push('[data-pt] aninhado dentro de <' + h.tag + '>'); continue; }
    const open = '<' + h.tag + h.before + h.after + '>';
    html = html.slice(0, h.start) + open + decode(h.pt) + html.slice(h.end);
  }
  return { html, n: hits.length };
}

/* data-pt lives in an attribute, so its own markup arrives escaped. */
function decode(v) {
  return v.replace(/&quot;/g, '"');
}

/* alt / aria-label / href variants: a plain attribute swap inside one tag. */
function applyAttr(html, from, to) {
  let n = 0;
  html = html.replace(new RegExp('<[^>]*\\s' + from + '="[^"]*"[^>]*>', 'g'), tag => {
    const v = tag.match(new RegExp('\\s' + from + '="([^"]*)"'));
    if (!v) return tag;
    n++;
    return tag
      .replace(new RegExp('\\s' + to + '="[^"]*"'), ' ' + to + '="' + v[1] + '"')
      .replace(new RegExp('\\s' + from + '="[^"]*"'), '');
  });
  return { html, n };
}

const alternates = (enUrl, ptUrl) =>
  '<link rel="alternate" hreflang="en" href="' + enUrl + '">\n' +
  '<link rel="alternate" hreflang="pt-BR" href="' + ptUrl + '">\n' +
  '<link rel="alternate" hreflang="x-default" href="' + enUrl + '">';

let failed = 0;
const built = [];

for (const page of PAGES) {
  const srcPath = path.join(ROOT, page.src);
  let html = fs.readFileSync(srcPath, 'utf-8');
  const report = [];

  const enUrl = SITE + '/' + page.dir;
  const ptUrl = SITE + '/pt/' + page.dir;

  /* 1 · text and attributes */
  const text = applyText(html, report);
  html = text.html;
  const alt = applyAttr(html, 'data-pt-alt', 'alt');       html = alt.html;
  const lab = applyAttr(html, 'data-pt-label', 'aria-label'); html = lab.html;
  const href = applyAttr(html, 'data-pt-href', 'href');    html = href.html;

  /* 2 · document language */
  html = html.replace('<html lang="en">', '<html lang="pt-BR">');

  /* 3 · head */
  html = html.replace(/<title>[\s\S]*?<\/title>/,
    '<title>' + page.title + (page.src === 'index.html' ? '' : ' — Guilherme Kerber') + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + page.desc + '$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + page.title + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + (page.ogDesc || page.desc) + '$2');
  html = html.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="pt_BR">');
  html = html.replace(/(<link rel="canonical" href=")[^"]*(">)/, '$1' + ptUrl + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/, '$1' + ptUrl + '$2');
  html = html.replace(/\n?\s*<link rel="alternate"[^>]*>/g, '');
  html = html.replace(/(<link rel="canonical"[^>]*>)/, '$1\n' + alternates(enUrl, ptUrl));

  /* 4 · one more level up for anything under /assets/.
         Page-to-page links are already relative and stay inside /pt/. */
  html = html.replace(/(["'(])((?:\.\.\/)*)assets\//g, '$1../$2assets/');

  /* 5 · the switcher points the other way */
  html = html.replace(
    '<a class="lang-btn is-active" href="/" hreflang="en">EN</a>',
    '<a class="lang-btn" href="/" hreflang="en" aria-label="View in English">EN</a>');
  html = html.replace(
    '<a class="lang-btn" href="/pt/" hreflang="pt-BR" aria-label="Ver em português">PT</a>',
    '<a class="lang-btn is-active" href="/pt/" hreflang="pt-BR">PT</a>');

  /* 6 · a generated file should say so */
  html = html.replace('<head>',
    '<head>\n<!-- Gerado por tools/build-pt.js a partir de /' + page.src + '. Não edite aqui. -->');

  const outPath = path.join(ROOT, 'pt', page.dir, 'index.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');

  const left = (html.match(/data-pt[-a-z]*="/g) || []).length;
  if (left) report.push(left + ' atributo(s) data-pt não aplicados');
  if (report.length) { failed++; console.log('  ' + page.src + ':\n    - ' + report.join('\n    - ')); }

  built.push({ page, enUrl, ptUrl });
  console.log('  ' + ('pt/' + page.dir).padEnd(28) +
    text.n + ' textos, ' + alt.n + ' alts, ' + lab.n + ' labels, ' + href.n + ' links' +
    (report.length ? '   <-- PROBLEMA' : ''));
}

/* sitemap: both languages, each pointing at the other */
const today = new Date().toISOString().slice(0, 10);
const entries = built.map(b => {
  const alt = [
    '    <xhtml:link rel="alternate" hreflang="en" href="' + b.enUrl + '"/>',
    '    <xhtml:link rel="alternate" hreflang="pt-BR" href="' + b.ptUrl + '"/>',
    '    <xhtml:link rel="alternate" hreflang="x-default" href="' + b.enUrl + '"/>',
  ].join('\n');
  const prio = b.page.src === 'index.html' ? '1.0' : '0.8';
  return [b.enUrl, b.ptUrl].map(loc =>
    '  <url>\n    <loc>' + loc + '</loc>\n' + alt +
    '\n    <lastmod>' + today + '</lastmod>\n    <priority>' + prio + '</priority>\n  </url>'
  ).join('\n');
}).join('\n');

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  entries + '\n' +
  '  <url>\n    <loc>' + SITE + '/design-system.html</loc>\n    <lastmod>' + today +
  '</lastmod>\n    <priority>0.3</priority>\n  </url>\n' +
  '</urlset>\n', 'utf-8');
console.log('  sitemap.xml            ' + (built.length * 2 + 1) + ' URLs');

if (failed) { console.log('\n  ' + failed + ' página(s) com problema'); process.exit(1); }
console.log('\n  /pt/ gerado');
