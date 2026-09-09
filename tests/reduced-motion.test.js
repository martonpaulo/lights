// Regression cover for issue #14: when the viewer asks for less motion the world
// keeps living, but the decoration laid over it stops moving.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const REDUCE = '(prefers-reduced-motion: reduce)';

/** Radii the node pass asked the canvas to draw, frame by frame. */
function nodeRadii(field, frames) {
  const series = [];
  for (let i = 0; i < frames; i++) {
    const calls = field.recordFrame();
    series.push(calls.filter((call) => call[0] === 'arc').map((call) => call[3]));
  }
  return series;
}

function spread(series) {
  const length = Math.min(...series.map((frame) => frame.length));
  let widest = 0;
  for (let i = 0; i < length; i++) {
    const values = series.map((frame) => frame[i]);
    widest = Math.max(widest, Math.max(...values) - Math.min(...values));
  }
  return widest;
}

test('the camera stops drifting when reduced motion is requested', () => {
  const field = loadField({ reducedMotion: true });
  field.frame(60);
  assert.equal(field.field.camX, 0);
  assert.equal(field.field.camY, 0);
});

test('the camera still drifts by default', () => {
  const field = loadField();
  field.frame(60);
  assert.ok(Math.abs(field.field.camX) + Math.abs(field.field.camY) > 0.1);
});

test('the grain stops wandering when reduced motion is requested', () => {
  const calm = loadField({ reducedMotion: true });
  calm.frame(10);
  const calmOffsets = new Set(calm.recordFrame().concat(calm.recordFrame())
    .filter((call) => call[0] === 'translate' && call[1] <= 0 && call[2] <= 0)
    .map((call) => `${call[1]},${call[2]}`));
  assert.deepEqual([...calmOffsets], ['0,0']);

  const lively = loadField();
  lively.frame(10);
  const livelyOffsets = new Set(lively.recordFrame().concat(lively.recordFrame())
    .filter((call) => call[0] === 'translate' && call[1] < 0)
    .map((call) => `${call[1]},${call[2]}`));
  assert.ok(livelyOffsets.size >= 2, 'the ordinary path still moves the grain each frame');
});

test('lights stop flickering when reduced motion is requested', () => {
  const calm = loadField({ reducedMotion: true });
  calm.frame(10);
  const lively = loadField();
  lively.frame(10);

  // Freeze everything except the flicker term, so the drawn radii isolate it.
  for (const field of [calm, lively]) {
    field.field.e = [];
    field.field.bonds = [];
    field.field.bombs = [];
    field.field.events = [];
    field.field.n.forEach((node) => { node.vx = 0; node.vy = 0; node.lumenTo = node.lumen; node.twin = null; node.trail = null; });
  }

  assert.ok(spread(nodeRadii(calm, 6)) < 1e-9, 'a calm light holds one size');
  assert.ok(spread(nodeRadii(lively, 6)) > 0.01, 'the ordinary path keeps twinkling');
});

test('the world keeps living and speaking in the reduced-motion path', () => {
  const field = loadField({ reducedMotion: true });
  const before = field.field.n.map((node) => `${node.x},${node.y}`).join('|');
  field.frame(40);
  assert.notEqual(before, field.field.n.map((node) => `${node.x},${node.y}`).join('|'));

  const target = field.livingNodes()[0];
  field.press(target);
  assert.equal(field.field.selected, target);
  assert.match(field.caption.textContent, /\S/);
  assert.deepEqual(field.errors, []);
});

test('the preference is honoured when it changes, without a reload', () => {
  const field = loadField();
  field.frame(30);
  assert.ok(Math.abs(field.field.camX) + Math.abs(field.field.camY) > 0.1);

  field.mediaQuery(REDUCE).set(true);
  field.frame(5);
  assert.equal(field.field.camX, 0);
  assert.equal(field.field.camY, 0);

  field.mediaQuery(REDUCE).set(false);
  field.frame(30);
  assert.ok(Math.abs(field.field.camX) + Math.abs(field.field.camY) > 0.1);
});
