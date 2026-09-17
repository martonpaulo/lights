// Checks that the script embedded in site/index.html still parses.
//
//   node scripts/check-embedded-script.mjs
//
// The page has one inline <script> and no build step, so a syntax error would reach the live page
// unnoticed. Compiling it without running it is the cheapest proof it parses.

import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/);
if (!script) throw new Error('site/index.html has no inline <script> block');
new Function(script[1]);
process.stdout.write('embedded script parses\n');
