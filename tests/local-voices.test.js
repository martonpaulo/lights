// Regression cover for issue #2: speech must never leave the machine. Only voices
// the platform synthesises locally, in English, are eligible, and a light with no
// eligible voice says nothing rather than falling back to the browser default.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField, voice } from './harness.js';

const MIXED = [
  voice('Samantha', 'en-US', true),
  voice('Alex', 'en-US', true),
  voice('Daniel', 'en-GB', true),
  voice('Google US English', 'en-US', false),
  voice('Google UK English Male', 'en-GB', false),
  voice('Microsoft Aria Online (Natural)', 'en-US', false),
  voice('Luciana', 'pt-BR', true),
];

function speakFirst(field) {
  field.frame(10);
  const target = field.livingNodes()[0];
  field.press(target); // only a selected light speaks
  field.speech.spoken.length = 0;
  field.field.fn.speakNode(target, 'A written line for the record.', true);
  return target;
}

test('only local English voices are eligible', () => {
  const field = loadField({ voices: MIXED });
  const names = field.field.availableVoices.map((item) => item.name);
  assert.deepEqual(names.sort(), ['Alex', 'Daniel', 'Samantha']);
  for (const item of field.field.availableVoices) {
    assert.equal(item.localService, true);
    assert.match(item.lang, /^en([-_]|$)/i);
  }
});

test('a remote-only voice list leaves nothing to speak with', () => {
  const field = loadField({ voices: MIXED.filter((item) => !item.localService) });
  assert.deepEqual(field.field.availableVoices, []);

  speakFirst(field);
  assert.equal(field.speech.spoken.length, 0, 'no utterance may be submitted without an eligible local voice');
  assert.match(field.caption.textContent, /A written line for the record\./);
});

test('local voices in other languages are not eligible', () => {
  const field = loadField({ voices: [voice('Luciana', 'pt-BR', true), voice('Anna', 'de-DE', true)] });
  assert.deepEqual(field.field.availableVoices, []);
  speakFirst(field);
  assert.equal(field.speech.spoken.length, 0);
});

test('an empty voice list is survivable', () => {
  const field = loadField({ voices: [] });
  assert.deepEqual(field.field.availableVoices, []);
  speakFirst(field);
  assert.equal(field.speech.spoken.length, 0);
  assert.deepEqual(field.errors, []);
});

test('a late local English voice becomes usable, and a withdrawn one is dropped', () => {
  const field = loadField({ voices: [] });
  assert.deepEqual(field.field.availableVoices, []);

  field.speech.setVoices(MIXED);
  assert.equal(field.field.availableVoices.length, 3);

  const target = speakFirst(field);
  assert.equal(field.speech.spoken.length, 1);
  const used = field.speech.spoken[0].voice;
  assert.equal(used.localService, true);
  assert.match(used.lang, /^en([-_]|$)/i);

  // The platform drops the voice this light had cached; it must not keep pointing at it.
  field.speech.setVoices(MIXED.filter((item) => item.name !== used.name));
  assert.ok(!field.field.availableVoices.includes(used));
  assert.notEqual(field.field.fn.pickVoice(target), used);
});

test('an utterance always carries the eligible voice it was given', () => {
  const field = loadField({ voices: MIXED });
  speakFirst(field);
  assert.ok(field.speech.spoken.length > 0);
  for (const utterance of field.speech.spoken) {
    assert.ok(utterance.voice, 'a submitted utterance must name a voice');
    assert.equal(utterance.voice.localService, true);
    assert.equal(utterance.lang, utterance.voice.lang);
  }
});
