// Regression cover for issue #1: the field must run when Web Speech or Web Audio
// is missing, and a failed optional start must not look like a successful one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

test('the field starts and speaks its written lines without the Web Speech API', () => {
  const field = loadField({ speech: false });

  assert.equal(field.field.n.length, 40);
  assert.equal(field.canvas.width, 1440);

  field.frame(20);
  const target = field.livingNodes()[0];
  field.press(target);

  assert.equal(field.field.selected, target);
  assert.match(field.caption.textContent, /\S/);
  assert.ok(field.caption.classList.contains('visible'));

  field.key('Escape');
  assert.equal(field.field.selected, null);
  assert.deepEqual(field.errors, []);
});

test('an absent Web Audio API leaves the field usable and audio unstarted', () => {
  const field = loadField({ audio: false });

  field.window.dispatch('pointerdown', { pointerId: 1 });
  assert.equal(field.field.toneContext, null);
  assert.equal(field.field.audioStarted, false, 'audioStarted must not claim a context that was never built');

  field.field.fn.spawnComet(100, 100);
  field.field.fn.spawnPortals(200, 200);
  field.field.fn.spawnAttractor(300, 300);
  field.field.fn.dropBomb(400, 400, 0.5);
  field.frame(30);

  const slider = field.element('sfx-volume');
  slider.value = '0.4';
  slider.dispatch('input');

  assert.deepEqual(field.errors, []);
});

test('music playback still works when only Web Audio is missing', () => {
  const field = loadField({ audio: false });
  field.element('sound').dispatch('click');
  assert.equal(field.music.paused, false);
});

test('the supported path still builds a tone context on the first gesture', () => {
  const field = loadField();
  field.window.dispatch('pointerdown', { pointerId: 1 });
  assert.notEqual(field.field.toneContext, null);
  assert.equal(field.field.audioStarted, true);
});
