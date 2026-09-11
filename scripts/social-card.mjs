// Renders the link-preview card from design/social-card/social-card.html.
//
//   node scripts/social-card.mjs        (on a Mac, with ImageMagick)
//
// The HTML is the source of truth; social-card.jpg is written from it at exactly the 1200x630 the
// meta tags declare and is never edited by hand. JPEG q92 with 4:4:4 chroma keeps the night sky
// free of the banding an 8-bit PNG palette puts in it. design/social-card/field.jpg is a real frame
// of the canvas, captured at a 700x630 viewport with the controls hidden.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'design', 'social-card', 'social-card.html');
const OUT = join(ROOT, 'social-card.jpg');
const SIZE = { width: 1200, height: 630 };

const dir = mkdtempSync(join(tmpdir(), 'lights-card-'));
const png = join(dir, 'card.png');
const { chromium } = await import('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: png, clip: { x: 0, y: 0, ...SIZE } });
} finally {
  await browser.close();
}
execFileSync('magick', [png, '-strip', '-quality', '92', '-sampling-factor', '4:4:4', '-interlace', 'Plane', OUT]);
rmSync(dir, { recursive: true, force: true });
process.stdout.write(`social-card.jpg ${SIZE.width}x${SIZE.height} — ${(statSync(OUT).size / 1024).toFixed(0)} kB\n`);
