// Captures the README screenshot from a real browser window on a real screen.
//
//   node scripts/screenshot.mjs
//
// Why it works this way, so the method is not lost:
//
// * The window is captured where it lives, with `screencapture -l<windowid>`.
//   Rendering the page offscreen would produce the right pixels and none of the
//   macOS window: no shadow, no rounded corners, no elevation, and raising the
//   scale factor does not bring them back.
// * `-o` is never passed. That is the flag that strips the shadow.
// * The display must be Retina. A capture inherits the scale of the screen it is
//   on, so a 1x monitor silently halves the resolution.
// * The window is brought to the front and given a few run-loop turns before the
//   shutter, otherwise it is captured inactive: grey traffic lights, dimmed chrome.
// * The browser is one this script launches — a clean Chromium from Playwright,
//   with no profile, no bookmarks bar and no automation banner. It never captures
//   a window belonging to the person running it. A browser cannot print its own
//   CGWindowID the way a native app can, so ownership is established by the
//   process id launched here, and the capture is refused unless exactly one
//   on-screen window belongs to it.
// * The window size is fixed here rather than taken from the screen, so the same
//   image comes out on another machine.
// * The published image is capped at PUBLISH_WIDTH: twice the widest place it is
//   shown. A capture at display scale is only the right size if something
//   displays it at half those pixels.
// * The result is lossless WebP — identical pixels, the shadow's alpha intact,
//   and roughly a third of the bytes of the PNG.

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, rm, stat, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs', 'images');
const OUT = join(OUT_DIR, 'field.webp');
// screencapture refuses some destinations; a plain temp file is always writable.
const RAW = join(tmpdir(), 'small-lights-field.png');

// Wide enough for the desktop layout the page switches to above 1024 CSS pixels.
const WINDOW = { width: 1180, height: 740, x: 90, y: 70 };
const PUBLISH_WIDTH = 1760;

const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };

function serve() {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) return void response.writeHead(403).end();
    try {
      response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
        .end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise((done) => server.close(done)),
  })));
}

async function retinaScreen() {
  const { stdout } = await run('/usr/sbin/system_profiler', ['SPDisplaysDataType']);
  return /Retina/i.test(stdout);
}

/** Every on-screen window, from scripts/window-id.swift. */
async function windows() {
  const { stdout } = await run('/usr/bin/swift', [join(ROOT, 'scripts', 'window-id.swift')]);
  return stdout.trim().split('\n').filter(Boolean).map((line) => {
    const [id, pid, size, app, ...title] = line.split('\t');
    return { id: Number(id), pid: Number(pid), size, app, title: title.join('\t') };
  });
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('this capture is macOS-only: it uses screencapture');
  if (!await retinaScreen()) throw new Error('run this on a Retina display, or the capture comes out at half resolution');

  await mkdir(OUT_DIR, { recursive: true });
  const site = await serve();
  const { chromium } = await import('playwright');
  const profile = await mkdtemp(join(tmpdir(), 'small-lights-shot-'));
  // A persistent context opens exactly one window with exactly one page, so
  // there is no blank second window to confuse the capture.
  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: null,
    // No automation banner, no first-run bubbles: this is a photograph of the page.
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      // An app window: title bar and page, no tab strip and no address bar, so the
      // picture is of the piece rather than of a local port number.
      `--app=${site.url}`,
      `--window-size=${WINDOW.width},${WINDOW.height}`,
      `--window-position=${WINDOW.x},${WINDOW.y}`,
      '--hide-crash-restore-bubble',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    const page = context.pages()[0] || await context.waitForEvent('page');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);

    // Give the picture something to say: a light selected and the guide open.
    const spots = await page.evaluate(() => {
      const canvas = document.querySelector('#c');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      const found = [];
      for (let y = 60; y < height - 60; y += 2) {
        for (let x = 60; x < width - 60; x += 2) {
          const at = (y * width + x) * 4;
          const lum = data[at] + data[at + 1] + data[at + 2];
          if (lum < 620 || found.some((spot) => Math.hypot(spot.x - x, spot.y - y) < 80)) continue;
          found.push({ x, y, lum });
        }
      }
      return found.sort((a, b) => b.lum - a.lum).slice(0, 6).map((spot) => [spot.x, spot.y]);
    });
    await page.evaluate(() => document.querySelector('#hint').classList.remove('gone'));
    // Prefer a light that carries a trait, so the credit line shows what it says.
    let credit = '';
    for (const [x, y] of spots) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(500);
      const shown = await page.evaluate(() => {
        const line = document.querySelector('#caption .credit');
        return document.querySelector('#caption').classList.contains('visible') && line ? line.textContent : '';
      });
      if (shown) credit = shown;
      if (shown.split(' · ').length >= 3) break;
    }
    if (!credit) throw new Error('no light was selected: the capture would show an empty caption');
    await page.waitForTimeout(1600);

    // A browser cannot print its own CGWindowID, so the window is identified by
    // the title of the page this script opened, inside a browser that exists only
    // because this script launched it. Anything less exact is refused.
    const title = await page.title();
    const owned = (await windows()).filter((window) => window.title === title);
    if (owned.length !== 1) {
      throw new Error(`expected exactly one on-screen window titled "${title}", found ${owned.length}`);
    }
    const pid = owned[0].pid;

    // Active window, then a few run-loop turns, then the shutter: an inactive
    // window is captured with grey traffic lights and dimmed controls.
    await run('/usr/bin/osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`]);
    await page.waitForTimeout(1200);

    await rm(RAW, { force: true });
    // never -o: that is the flag that removes the shadow
    const shot = await run('/usr/sbin/screencapture', ['-x', `-l${owned[0].id}`, RAW]);
    if (!await stat(RAW).catch(() => null)) {
      throw new Error(`screencapture wrote nothing for window ${owned[0].id} (${owned[0].app}, "${owned[0].title}")`
        + `${shot.stderr ? `: ${shot.stderr.trim()}` : ''}`);
    }
    const { stdout: raw } = await run('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', RAW]);
    const width = Number(raw.match(/pixelWidth:\s*(\d+)/)[1]);
    const height = Number(raw.match(/pixelHeight:\s*(\d+)/)[1]);
    if (width < WINDOW.width * 1.5) throw new Error(`captured ${width}px wide: this looks like a 1x display`);

    if (width > PUBLISH_WIDTH) await run('/usr/bin/sips', ['--resampleWidth', String(PUBLISH_WIDTH), RAW, '--out', RAW]);
    await run('cwebp', ['-lossless', '-alpha_q', '100', '-q', '100', RAW, '-o', OUT]);

    const png = await stat(RAW);
    const webp = await stat(OUT);
    const { stdout: final } = await run('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', OUT]);
    await rm(RAW, { force: true });
    process.stdout.write(
      `captured window ${owned[0].id} (${owned[0].app}) at ${width}x${height}\n`
      + `published ${OUT.replace(`${ROOT}/`, '')} ${final.match(/pixelWidth:\s*(\d+)/)[1]}x${final.match(/pixelHeight:\s*(\d+)/)[1]}`
      + ` — ${(webp.size / 1024).toFixed(0)} kB lossless WebP, ${(100 - (webp.size / png.size) * 100).toFixed(0)}% smaller than the PNG\n`,
    );
  } finally {
    await context.close();
    await site.close();
    await rm(profile, { recursive: true, force: true });
  }
}

await main();
