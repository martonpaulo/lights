// Regression cover for issue #8: a slot waiting for its next occupant takes no
// part in anything — selection, captions, speech, its own tone, forces, events
// or bonding — until a new life arrives.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

/** Drives a light through the last moment of its life into absence. */
function killOff(field, node) {
  node.dying = 1;
  node.fade = 0.99;
  field.advance(1000);
  assert.ok(node.absent > 0, 'the light should have gone dark');
  return node;
}

test('a light that goes dark leaves the selection and the caption', () => {
  const field = loadField();
  field.frame(10);
  const target = field.livingNodes()[0];
  field.press(target);
  const name = target.personality;
  assert.equal(field.field.selected, target);

  killOff(field, target);

  assert.equal(field.field.selected, null);
  assert.ok(!field.field.selection.includes(target));
  assert.ok(!field.caption.textContent.includes(name) || !field.caption.classList.contains('visible'));
});

test('the other selected light keeps its place when its companion goes dark', () => {
  const field = loadField();
  field.frame(10);
  const first = field.livingNodes()[0];
  const second = field.livingNodes().find((node) => node !== first && Math.hypot(node.x - first.x, node.y - first.y) > 150);
  field.press(first);
  field.press(second, { ctrlKey: true });
  assert.equal(field.field.selection.length, 2);

  killOff(field, first);

  assert.equal(field.field.selection.length, 1);
  assert.equal(field.field.selection[0], second);
  assert.equal(field.field.selected, second);
  field.speech.spoken.length = 0;
  assert.equal(field.field.fn.speakNode(second, 'I am still here.', true), true);
});

test('a light that goes dark mid-sentence stops speaking', () => {
  const field = loadField();
  field.frame(10);
  const target = field.livingNodes()[0];
  field.press(target);
  // Long enough that the line is still running when the light goes dark.
  const line = Array.from({ length: 12 }, (_, i) => `Clause number ${i} is on its way.`).join(' ');
  field.field.fn.speakNode(target, line, true);

  killOff(field, target);
  const spokenAtDeath = field.speech.spoken.length;
  assert.ok(spokenAtDeath > 0 && spokenAtDeath < 12, `the line should still be running, ${spokenAtDeath} of 12 clauses out`);

  field.advance(4000);

  assert.equal(field.speech.spoken.length, spokenAtDeath, 'no clause may follow the light into the dark');
  assert.equal(field.field.activeSpeech, 0);
});

test('a light that goes dark while queued never gets its turn', () => {
  const field = loadField();
  field.frame(10);
  const first = field.livingNodes()[0];
  const queued = field.livingNodes().find((node) => node !== first && Math.hypot(node.x - first.x, node.y - first.y) > 150);
  field.press(first);
  field.press(queued, { ctrlKey: true });
  field.field.speakQueue.length = 0;
  field.field.speakQueue.push(queued);

  killOff(field, queued);

  assert.ok(!field.field.speakQueue.includes(queued));
  field.speech.spoken.length = 0;
  field.advance(5000);
  assert.ok(field.field.lastCaption === null || field.field.lastCaption.node !== queued);
});

test('an absent light is not moved by an attractor or by damping', () => {
  const field = loadField();
  const sleeper = field.field.n[0];
  sleeper.absent = 12;
  sleeper.x = 500;
  sleeper.y = 500;
  sleeper.vx = 0.2;
  sleeper.vy = 0;
  sleeper.boost = 0;

  field.field.fn.spawnAttractor(700, 500);
  field.field.fn.simulationStep();

  assert.equal(sleeper.vx, 0.2, 'velocity must be untouched by the event and the damping pass');
  assert.equal(sleeper.vy, 0);
  assert.equal(sleeper.boost || 0, 0);
  assert.equal(sleeper.x, 500);
});

test('an absent light holds no tone, and gets one again when it returns', () => {
  const field = loadField();
  field.window.dispatch('pointerdown', { pointerId: 1 });
  assert.ok(field.field.tones.length > 0);
  const sleeper = field.field.n[0];

  field.field.fn.simulationStep();
  assert.ok(field.field.tones[0].gain.gain.value > 0);

  sleeper.absent = 12;
  field.field.fn.simulationStep();
  assert.equal(field.field.tones[0].gain.gain.value, 0);

  sleeper.absent = 0;
  field.field.fn.simulationStep();
  assert.ok(field.field.tones[0].gain.gain.value > 0);
});

test('a resize never bonds a slot that is waiting for an occupant', () => {
  const field = loadField();
  field.field.e = [];
  field.field.n[0].absent = 20;
  field.field.n[0].twin = null;
  field.field.n[1].twin = null;

  field.resize(1000, 700);

  for (const bond of field.field.e) {
    assert.ok(!field.field.n[bond.a].absent && !field.field.n[bond.b].absent, 'a bond was made with an absent slot');
  }
});

test('the new occupant arrives unselected and unspoken for', () => {
  const field = loadField();
  field.frame(10);
  const target = field.livingNodes()[0];
  field.press(target);
  killOff(field, target);

  target.absent = 1;
  field.advance(1000);

  assert.equal(target.absent, 0, 'the slot should have been filled again');
  assert.equal(field.field.selected, null, 'a stale reference must not select the new occupant');
  assert.ok(!field.field.selection.includes(target));
  assert.deepEqual(field.errors, []);
});
