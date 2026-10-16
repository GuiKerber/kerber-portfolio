/* Records a micro-interaction loop to MP4, one file per platform.
   ---------------------------------------------------------------------
   Run from the project root:

       node tools/record-loop/record.js micro-interactions/<folder>
       node tools/record-loop/record.js micro-interactions/<folder> --only x,linkedin

   It serves the project on a local port, opens the exploration at each
   format's size with ?record=<format>, seeks the loop frame by frame
   (see micro-interactions/shared/loop.js) and pipes every frame to ffmpeg.
   The loop's own clock drives the frames, so no frame is ever dropped and
   the last one meets the first. Videos land in micro-interactions/exports/. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { once } = require('events');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ffmpegPath = require('ffmpeg-static');

const ROOT = path.resolve(__dirname, '..', '..');
const EXPORTS = path.join(ROOT, 'micro-interactions', 'exports');
const SCALE = 2; // CSS pixels are rendered at 2x for sharp text and edges

/* Limits from each platform's help center, checked 2026-10-14:
   - Dribbble: MP4 up to 20 MB, at least 1600 px wide, any ratio.
   - LinkedIn: ratio 1:2.4 to 2.4:1, 10 to 60 fps, at least 3 s and 75 KB.
     Flat UI loops compress below 75 KB, so LinkedIn gets a constant bitrate.
   - X (web upload): up to 1920x1200, at most 40 fps and 25 Mbps;
     videos of 60 s or less loop on their own. */
const FORMATS = {
  dribbble: { width: 800, height: 600, fps: 60, maxBytes: 20e6 },                // 1600x1200, 4:3
  linkedin: { width: 540, height: 675, fps: 60, minSeconds: 3, constantRate: '8M' }, // 1080x1350, 4:5
  x: { width: 960, height: 540, fps: 30 },                                       // 1920x1080, 16:9
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function encoder(file, { fps, constantRate }) {
  const rate = constantRate
    ? ['-b:v', constantRate, '-minrate', constantRate, '-maxrate', constantRate, '-bufsize', '16M', '-x264-params', 'nal-hrd=cbr']
    : ['-crf', '18', '-maxrate', '16M', '-bufsize', '32M'];
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    // Screenshots are sRGB; tag and convert as BT.709 so the colours don't shift
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high',
    ...rate,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an',
    file,
  ];
  const ff = spawn(ffmpegPath, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
  return { ff, done };
}

async function record(browser, base, name, format) {
  const spec = FORMATS[format];
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: SCALE,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${base}/micro-interactions/${name}/?record=${format}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__loop && window.__loop.ready, null, { timeout: 15000 });
  if (errors.length) throw new Error(`${format}: the page has errors\n  ${errors.join('\n  ')}`);

  const duration = await page.evaluate(() => window.__loop.duration);
  if (!(duration > 0)) throw new Error(`${format}: the loop has no duration (is the timeline empty?)`);

  // Short loops repeat until the platform's minimum length
  const repeats = Math.max(1, Math.ceil(((spec.minSeconds || 0) * 1000) / duration));
  const loopFrames = Math.round((duration / 1000) * spec.fps);
  const frames = loopFrames * repeats;

  const dir = path.join(EXPORTS, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${format}.mp4`);
  const { ff, done } = encoder(file, spec);

  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = ((i % loopFrames) * 1000) / spec.fps;
    await page.evaluate((ms) => window.__loop.seek(ms), t);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
    if (i % spec.fps === 0) process.stdout.write(`\r  ${format}: frame ${i + 1}/${frames}`);
  }
  ff.stdin.end();
  await done;
  await context.close();

  const bytes = fs.statSync(file).size;
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const size = `${spec.width * SCALE}x${spec.height * SCALE}`;
  console.log(`\r  ${format}: ${size}, ${spec.fps} fps, ${(frames / spec.fps).toFixed(2)} s, ${(bytes / 1e6).toFixed(1)} MB (${seconds} s to record)`);
  if (spec.maxBytes && bytes > spec.maxBytes) {
    console.warn(`  ! ${format}: over the ${spec.maxBytes / 1e6} MB upload limit`);
  }
  return file;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const onlyIndex = args.indexOf('--only');
  const formats = onlyIndex > -1 ? args[onlyIndex + 1].split(',') : Object.keys(FORMATS);

  if (!target) {
    console.error('Usage: node tools/record-loop/record.js micro-interactions/<folder> [--only dribbble,linkedin,x]');
    process.exit(1);
  }
  const folder = path.resolve(ROOT, target);
  if (!fs.existsSync(path.join(folder, 'index.html'))) {
    console.error(`No index.html in ${folder}`);
    process.exit(1);
  }
  const unknown = formats.filter((f) => !FORMATS[f]);
  if (unknown.length) {
    console.error(`Unknown format: ${unknown.join(', ')}. Use ${Object.keys(FORMATS).join(', ')}.`);
    process.exit(1);
  }

  const name = path.basename(folder);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  console.log(`Recording ${name}`);
  try {
    for (const format of formats) await record(browser, base, name, format);
    console.log(`Done: ${path.relative(ROOT, path.join(EXPORTS, name))}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
