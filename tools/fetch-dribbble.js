/* Downloads the Dribbble shots used in the About section.
   ---------------------------------------------------------------------
   Run from the project root when the shot list changes:

       node tools/fetch-dribbble.js

   It reads the public profile page, keeps the shots listed in SHOTS
   below (by title), and saves each one as a 4:3 webp in assets/dribbble/.
   Dribbble's own CDN does the resizing, so nothing is processed locally. */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'dribbble');
const PROFILE = 'https://dribbble.com/kerber';
const SIZE = '800x600';           // 4:3, enough for a 400px slot at 2x
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

function get(url, asBuffer) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location, asBuffer));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + ' -> ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

/* Pulls {img, link, title} out of the profile markup. */
function parse(html) {
  const parts = html.split('data-shot-thumbnail-link=');
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    const imgs = [...parts[i - 1].matchAll(/data-src="(https:\/\/cdn\.dribbble\.com\/userupload\/[^"?]+)/g)];
    const img = imgs.length ? imgs[imgs.length - 1][1] : null;
    const link = (parts[i].match(/href="(\/shots\/[0-9][^"]*)"/) || [])[1];
    const title = (parts[i].match(/class="shot-title">\s*([^<]+?)\s*<\/div>/) || [])[1];
    if (img && link && title && !out.some(o => o.link === link)) out.push({ img, link, title });
  }
  return out;
}

const slug = t => t.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);

(async () => {
  const shots = parse(await get(PROFILE, false));
  if (!shots.length) { console.log('  nenhum shot encontrado — o HTML do Dribbble mudou'); process.exit(1); }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = [];
  let bytes = 0;

  for (const s of shots) {
    const name = slug(s.title) + '.webp';
    const url = s.img + '?format=webp&resize=' + SIZE + '&vertical=center';
    const buf = await get(url, true);
    fs.writeFileSync(path.join(OUT, name), buf);
    bytes += buf.length;
    manifest.push({ file: 'assets/dribbble/' + name, title: s.title, url: 'https://dribbble.com' + s.link });
    console.log('  ' + String(Math.round(buf.length / 1024)).padStart(4) + ' KB  ' + name);
  }

  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('\n  ' + manifest.length + ' shots, ' + Math.round(bytes / 1024) + ' KB no total');
  console.log('  lista em assets/dribbble/shots.json');
})().catch(e => { console.log('  ERRO: ' + e.message); process.exit(1); });
