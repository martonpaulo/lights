// Regression cover for issue #12: unlocking audio on a gesture must not override
// a playback choice the viewer already made.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const label = (field) => field.element('sound').getAttribute('aria-label');
const glyph = (field) => field.element('sound').textContent;

async function settle(field) {
  await Promise.resolve();
  await Promise.resolve();
  field.advance(1);
}

test('a deliberate pause survives the first key press of the session', async () => {
  const field = loadField();
  field.window.dispatch('pointerdown', { pointerId: 1, target: field.canvas });
  await settle(field);
  assert.equal(field.music.paused, false);

  field.element('sound').dispatch('click');
  await settle(field);
  assert.equal(field.music.paused, true);

  field.key('Escape');
  await settle(field);
  assert.equal(field.music.paused, true, 'the first keydown must not restart paused music');
  assert.equal(glyph(field), '▶');
  assert.equal(label(field), 'Play music');
});

test('a deliberate pause survives the first pointer press of the session', async () => {
  const field = loadField();
  field.key('a');
  await settle(field);
  assert.equal(field.music.paused, false);

  field.element('sound').dispatch('click');
  await settle(field);
  assert.equal(field.music.paused, true);

  field.window.dispatch('pointerdown', { pointerId: 1, target: field.canvas });
  await settle(field);
  assert.equal(field.music.paused, true);
});

test('the first gesture of the session may be the music button itself', async () => {
  const field = loadField();
  const button = field.element('sound');
  // The real order for a click on the button: pointerdown at the target, then click.
  button.dispatch('pointerdown', { pointerId: 1 });
  field.window.dispatch('pointerdown', { pointerId: 1, target: button });
  button.dispatch('click');
  await settle(field);

  assert.equal(field.music.paused, false, 'startup and toggle must not cancel each other out');
  assert.equal(glyph(field), '❚❚');
  assert.equal(label(field), 'Pause music');
});

test('a rejected play leaves the button showing what is really happening', async () => {
  const field = loadField();
  field.music.playRejects = true;
  field.window.dispatch('pointerdown', { pointerId: 1, target: field.canvas });
  await settle(field);

  assert.equal(field.music.paused, true);
  assert.equal(glyph(field), '▶');
  assert.equal(label(field), 'Play music');
});

test('play after a pause still works', async () => {
  const field = loadField();
  field.window.dispatch('pointerdown', { pointerId: 1, target: field.canvas });
  await settle(field);
  field.element('sound').dispatch('click');
  await settle(field);
  field.element('sound').dispatch('click');
  await settle(field);
  assert.equal(field.music.paused, false);
  assert.equal(label(field), 'Pause music');
});
