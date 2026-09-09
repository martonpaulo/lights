// Browser acceptance for the three engine families the project accepts.
//
// This is the expensive half of the pipeline: it downloads and drives real
// Chromium, Gecko and WebKit builds, so it only runs when something a browser
// can actually observe has changed. The cheap half is `node --test`, which needs
// nothing installed.
//
//   node tests/browser/acceptance.mjs               all three engines
//   node tests/browser/acceptance.mjs chromium      one engine
//
// Playwright is a checking tool, not a project dependency: it is installed on
// demand and the page itself still loads nothing.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function serve() {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise((done) => server.close(done)),
  })));
}

const results = [];
const environment = new Set();
function check(engine, name, passed, detail = '') {
  results.push({ engine, name, passed, detail });
  process.stdout.write(`${passed ? '  ok  ' : '  FAIL'} ${engine} · ${name}${detail ? ` — ${detail}` : ''}\n`);
}

/** Reads the canvas back to find drawn lights, so clicks land on them. */
const findLights = (page, count) => page.evaluate((wanted) => {
  const canvas = document.querySelector('#c');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const spots = [];
  for (let y = 40; y < height - 40; y += 2) {
    for (let x = 40; x < width - 40; x += 2) {
      const at = (y * width + x) * 4;
      const lum = data[at] + data[at + 1] + data[at + 2];
      if (lum < 600 || spots.some((spot) => Math.hypot(spot.x - x, spot.y - y) < 70)) continue;
      spots.push({ x, y, lum });
    }
  }
  return spots.sort((a, b) => b.lum - a.lum).slice(0, wanted).map((spot) => [spot.x, spot.y]);
}, count);

async function open(browser, url, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Reading pixels back is how these checks see the field; the browser's advice
    // about willReadFrequently is aimed at the probe, not at the page.
    if (/willReadFrequently/.test(message.text())) return;
    // A runner without an MP3 decoder cannot play the ambient track. That is the
    // machine's limitation, not the page's, and it is reported once at the end.
    if (/space-ambient-mix\.mp3|MEDIASINK|could not be decoded/i.test(message.text())) { environment.add('no MP3 decoder on this machine'); return; }
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`);
  });
  if (options.initScript) await page.addInitScript(options.initScript);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { page, problems };
}

async function runEngine(name, launcher, url) {
  const browser = await launcher.launch();

  // 1. The field starts, sized to the window, with nothing on the console.
  {
    const { page, problems } = await open(browser, url);
    const size = await page.evaluate(() => [document.querySelector('#c').width, document.querySelector('#c').height]);
    check(name, 'starts clean at 1440x900', size[0] === 1440 && size[1] === 900 && problems.length === 0,
      `canvas ${size.join('x')}, ${problems.length} problem(s) ${problems.slice(0, 2).join(' | ')}`);
    await page.close();
  }

  // 2. Only local English voices are ever handed to the synthesizer.
  {
    const submitted = [];
    const { page, problems } = await open(browser, url, {
      initScript: () => {
        const speak = window.speechSynthesis && window.speechSynthesis.speak.bind(window.speechSynthesis);
        if (speak) window.speechSynthesis.speak = (utterance) => {
          window.__submitted = (window.__submitted || []).concat([{
            local: utterance.voice ? utterance.voice.localService : null,
            lang: utterance.lang,
          }]);
          return speak(utterance);
        };
      },
    });
    const spots = await findLights(page, 6);
    for (const [x, y] of spots) { await page.mouse.click(x, y); await page.waitForTimeout(250); }
    await page.waitForTimeout(1500);
    submitted.push(...await page.evaluate(() => window.__submitted || []));
    const ineligible = submitted.filter((item) => item.local !== true || !/^en([-_]|$)/i.test(item.lang || ''));
    check(name, 'speaks only with local English voices', ineligible.length === 0 && problems.length === 0,
      `${submitted.length} utterance(s), ${ineligible.length} ineligible`);
    await page.close();
  }

  // 3. A conversation stays inside the selected pair.
  {
    const { page, problems } = await open(browser, url);
    const credits = () => page.evaluate(() => [...document.querySelectorAll('#caption .credit')].map((el) => el.textContent));
    const spots = await findLights(page, 8);
    let picked = [];
    for (const [x, y] of spots) {
      if (picked.length) await page.keyboard.down('Meta');
      await page.mouse.click(x, y);
      if (picked.length) await page.keyboard.up('Meta');
      await page.waitForTimeout(200);
      const now = await credits();
      if (now.length > picked.length) picked = now;
      if (picked.length === 2) break;
    }
    const held = new Set(picked.map((line) => line.split(' · ')[0]));
    const heard = new Set();
    for (let i = 0; i < 20; i++) { await page.waitForTimeout(500); (await credits()).forEach((line) => heard.add(line.split(' · ')[0])); }
    const strangers = [...heard].filter((who) => !held.has(who));
    check(name, 'only the selected lights speak', picked.length === 2 && strangers.length === 0 && problems.length === 0,
      `held [${[...held]}], heard [${[...heard]}]`);
    await page.close();
  }

  // 4. The whole field is reachable without a pointer.
  {
    const { page, problems } = await open(browser, url);
    const status = () => page.evaluate(() => document.querySelector('#field-status').textContent);
    const active = () => page.evaluate(() => {
      const el = document.activeElement;
      return el ? (el.id || `${el.tagName.toLowerCase()}${el.dataset.summon ? `:${el.dataset.summon}` : ''}`) : 'none';
    });
    const credits = () => page.evaluate(() => document.querySelectorAll('#caption .credit').length);
    await page.evaluate(() => document.querySelector('#c').focus());
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
    const named = (await status()).trim().length > 0;
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const one = await credits();
    const saysSelected = /selected/.test(await status());
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60);
    await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(300);
    const two = await credits();
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const cleared = await credits();
    await page.keyboard.press('s'); await page.waitForTimeout(250);
    const menuFocus = await active();
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const backToField = await active();
    await page.keyboard.press('b'); await page.waitForTimeout(300);
    check(name, 'the field works from the keyboard alone',
      named && one === 1 && saysSelected && two === 2 && cleared === 0
      && menuFocus.startsWith('button') && backToField === 'c' && problems.length === 0,
      `named=${named} select=${one}->${two}->${cleared} status=${saysSelected} menu=${menuFocus} back=${backToField}`);
    await page.close();
  }

  // 5. The written lines stay readable and the panel stays clear at phone width.
  {
    const { page, problems } = await open(browser, url, { viewport: { width: 390, height: 844 } });
    const layout = await page.evaluate(() => {
      const caption = document.querySelector('#caption');
      caption.innerHTML = '<div class="line"><strong>The Keeper of Small Things</strong>'
        + '<span class="credit">Konstantina Papadopoulou · 104</span>'
        + '<span class="text">I have drifted past the reach of everything, and nothing changed about me at all.</span></div>';
      caption.classList.add('visible');
      const box = caption.getBoundingClientRect();
      const panel = document.querySelector('#audio-panel').getBoundingClientRect();
      const overlapX = Math.max(0, Math.min(box.right, panel.right) - Math.max(box.left, panel.left));
      const overlapY = Math.max(0, Math.min(box.bottom, panel.bottom) - Math.max(box.top, panel.top));
      return {
        textWidth: Math.round(caption.querySelector('.text').getBoundingClientRect().width),
        overlap: Math.round(overlapX * overlapY),
        clipped: caption.scrollHeight > caption.clientHeight + 1,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        offscreen: box.bottom > window.innerHeight || box.top < 0,
      };
    });
    check(name, 'the caption is readable at 390px', layout.textWidth > 200 && !layout.overlap
      && !layout.clipped && !layout.pageOverflow && !layout.offscreen && problems.length === 0,
      `text ${layout.textWidth}px, panel overlap ${layout.overlap}, clipped ${layout.clipped}`);
    await page.close();
  }

  // 6. Shrinking and growing the window never strands a light outside it.
  {
    const { page, problems } = await open(browser, url);
    const lit = () => page.evaluate(() => {
      const canvas = document.querySelector('#c');
      const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let at = 0; at < data.length; at += 4) if (data[at] > 150) count++;
      return count;
    });
    const counts = [];
    for (const [width, height] of [[380, 700], [1440, 900], [900, 420], [320, 640], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1200);
      counts.push(await lit());
    }
    check(name, 'no light is stranded by a resize', Math.min(...counts) > 200 && problems.length === 0,
      `lit pixels ${counts.join(', ')}; ${problems.length} problem(s) ${problems.slice(0, 2).join(' | ')}`);
    await page.close();
  }

  // 7. Missing Web Speech or Web Audio is a quiet mode, not a failure.
  {
    const modes = {
      'no speech': () => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; },
      'no audio': () => { delete window.AudioContext; delete window.webkitAudioContext; },
      neither: () => {
        delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
        delete window.AudioContext; delete window.webkitAudioContext;
      },
    };
    for (const [mode, initScript] of Object.entries(modes)) {
      const { page, problems } = await open(browser, url, { initScript });
      const spots = await findLights(page, 4);
      for (const [x, y] of spots) { await page.mouse.click(x, y); await page.waitForTimeout(150); }
      await page.waitForTimeout(600);
      const state = await page.evaluate(() => ({
        canvas: document.querySelector('#c').width,
        visible: document.querySelector('#caption').classList.contains('visible'),
      }));
      check(name, `degrades quietly with ${mode}`, state.canvas === 1440 && state.visible && problems.length === 0,
        `caption ${state.visible ? 'shown' : 'missing'}, ${problems.length} problem(s) ${problems.slice(0, 2).join(' | ')}`);
      await page.close();
    }
  }

  // 8. Reduced motion stills the decoration without stopping the world.
  // Pixel churn is too noisy on a machine without a GPU, so the two things the
  // preference actually controls are read straight off the drawing calls: the
  // camera offset and where the film grain is laid down.
  {
    const watch = () => {
      const proto = CanvasRenderingContext2D.prototype;
      const setTransform = proto.setTransform;
      const translate = proto.translate;
      window.__camera = [];
      window.__grain = [];
      proto.setTransform = function (a, b, c, d, e, f) {
        if (arguments.length === 6 && a === 1 && b === 0 && c === 0 && d === 1) window.__camera.push([e, f]);
        return setTransform.apply(this, arguments);
      };
      proto.translate = function (x, y) {
        if (x <= 0 && y <= 0) window.__grain.push(`${x},${y}`);
        return translate.apply(this, arguments);
      };
    };
    const sample = async (motion) => {
      const { page, problems } = await open(browser, url, { reducedMotion: motion, initScript: watch });
      await page.waitForTimeout(1500);
      const seen = await page.evaluate(() => ({ camera: window.__camera, grain: [...new Set(window.__grain)] }));
      await page.close();
      return {
        drifted: seen.camera.some(([x, y]) => Math.abs(x) > 0.001 || Math.abs(y) > 0.001),
        grainPlaces: seen.grain.length,
        frames: seen.camera.length,
        problems: problems.length,
      };
    };
    const calm = await sample('reduce');
    const lively = await sample('no-preference');
    check(name, 'reduced motion stills the camera and the grain',
      calm.frames > 0 && !calm.drifted && calm.grainPlaces <= 1
      && lively.drifted && lively.grainPlaces > 1 && calm.problems === 0 && lively.problems === 0,
      `reduce: drift=${calm.drifted} grainPlaces=${calm.grainPlaces} over ${calm.frames} frames; `
      + `ordinary: drift=${lively.drifted} grainPlaces=${lively.grainPlaces} over ${lively.frames} frames`);
  }

  // 9. The page describes itself correctly to crawlers and link previews.
  {
    const { page, problems } = await open(browser, url);
    const head = await page.evaluate(() => {
      const meta = (selector) => (document.querySelector(selector) || {}).content || null;
      const ld = document.querySelector('script[type="application/ld+json"]');
      let graph = null;
      try { graph = JSON.parse(ld.textContent); } catch { graph = null; }
      return {
        lang: document.documentElement.lang,
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map((node) => node.textContent),
        headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((node) => Number(node.tagName[1])),
        canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
        description: meta('meta[name=description]'),
        themeColor: meta('meta[name=theme-color]'),
        ogImage: meta('meta[property="og:image"]'),
        ogType: meta('meta[property="og:image:type"]'),
        ogWidth: meta('meta[property="og:image:width"]'),
        ogHeight: meta('meta[property="og:image:height"]'),
        ogAlt: meta('meta[property="og:image:alt"]'),
        twitterCard: meta('meta[name="twitter:card"]'),
        twitterImage: meta('meta[name="twitter:image"]'),
        twitterAlt: meta('meta[name="twitter:image:alt"]'),
        canvasLabel: (document.querySelector('#c') || {}).ariaLabel || document.querySelector('#c').getAttribute('aria-label'),
        types: graph ? graph['@graph'].map((entry) => entry['@type']) : [],
      };
    });
    // The declared social image must exist and be exactly what the tags claim.
    const card = await page.evaluate((src) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = () => resolve([0, 0]);
      // The tags name the published URL; locally the file sits beside the page.
      image.src = src.split('/').pop();
    }), head.ogImage);
    const sitemap = await page.evaluate(async () => {
      const response = await fetch('sitemap.xml');
      return response.ok ? (await response.text()).includes('<loc>') : false;
    });
    const ordered = head.headings.every((level, at) => at === 0 ? level === 1 : level <= head.headings[at - 1] + 1);
    check(name, 'the page describes itself to crawlers and previews',
      head.lang === 'en' && head.title && head.h1.length === 1 && ordered
      && /^https:\/\/martonpaulo\.com\/small-lights\/$/.test(head.canonical)
      && head.description && head.themeColor
      && /\.png$/.test(head.ogImage) && head.ogType === 'image/png'
      && head.ogWidth === '1200' && head.ogHeight === '630' && head.ogAlt
      && head.twitterCard === 'summary_large_image' && head.twitterImage === head.ogImage && head.twitterAlt
      && card[0] === 1200 && card[1] === 630
      && head.types.includes('WebSite') && head.types.includes('VisualArtwork')
      && head.canvasLabel && sitemap && problems.length === 0,
      `lang=${head.lang} h1=${head.h1.length} headings=[${head.headings}] canonical=${head.canonical} `
      + `card=${card.join('x')} ${head.ogType} types=[${head.types}] sitemap=${sitemap}`);
    await page.close();
  }

  await browser.close();
}

const { chromium, firefox, webkit } = await import('playwright');
const ENGINES = { chromium, firefox, webkit };
const wanted = process.argv.slice(2).filter((argument) => argument in ENGINES);
const chosen = wanted.length ? wanted : Object.keys(ENGINES);

const site = await serve();
try {
  for (const engine of chosen) {
    process.stdout.write(`\n${engine}\n`);
    await runEngine(engine, ENGINES[engine], site.url);
  }
} finally {
  await site.close();
}

if (environment.size) process.stdout.write(`\nenvironment: ${[...environment].join('; ')}\n`);
const failed = results.filter((result) => !result.passed);
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed\n`);
if (failed.length) {
  for (const result of failed) process.stdout.write(`FAILED ${result.engine} · ${result.name} — ${result.detail}\n`);
  process.exitCode = 1;
}
