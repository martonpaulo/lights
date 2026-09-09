// Renders social-card.svg to the raster card the sharing previews need.
//
//   node scripts/social-card.mjs
//
// Facebook, X, LinkedIn and Slack do not render SVG in a link preview, so the
// designed card is rasterised once, at exactly the 1200x630 the platforms expect
// and the meta tags declare. The SVG stays the source of truth; the PNG is
// generated from it and never edited by hand.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'social-card.svg');
const OUT = join(ROOT, 'social-card.png');
const SIZE = { width: 1200, height: 630 };

const server = createServer(async (request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#05080d}svg{display:block}</style>${await readFile(SOURCE, 'utf8')}`,
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const { chromium } = await import('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, ...SIZE } });
} finally {
  await browser.close();
  server.close();
}

const written = await stat(OUT);
process.stdout.write(`social-card.png ${SIZE.width}x${SIZE.height} — ${(written.size / 1024).toFixed(0)} kB\n`);
