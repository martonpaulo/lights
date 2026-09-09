// Regression cover for issue #9: clearing the selection ends the whole speech
// session. Delayed clauses, replies and queued speakers must not outlive it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const TWO_CLAUSES = 'First sentence is finished. Second sentence must not start.';

function selectFirst(field) {
  field.frame(10);
  const target = field.livingNodes()[0];
  field.press(target);
  return target;
}

test('Escape during an utterance stops the rest of the line', () => {
  const field = loadField();
  const target = selectFirst(field);
  field.speech.spoken.length = 0;
  field.field.fn.speakNode(target, TWO_CLAUSES, true);
  assert.equal(field.speech.spoken.length, 1);

  field.key('Escape');
  field.advance(3000);

  assert.equal(field.speech.spoken.length, 1, 'no further clause may be submitted after Escape');
  assert.equal(field.field.selected, null);
  assert.equal(field.field.activeSpeech, 0);
});

test('Escape between clauses stops the next one', () => {
  const field = loadField();
  const target = selectFirst(field);
  field.speech.spoken.length = 0;
  field.field.fn.speakNode(target, TWO_CLAUSES, true);

  field.advance(11); // the first clause ends; the natural gap is now pending
  field.key('Escape');
  field.advance(3000);

  assert.equal(field.speech.spoken.length, 1);
});

test('Escape during a reply delay stops the answer', () => {
  const field = loadField();
  const target = selectFirst(field);
  field.field.n.forEach((node, index) => { if (index > 1) node.absent = 999; });
  const partner = field.field.n[1];
  partner.absent = 0;
  partner.x = target.x + 40;
  partner.y = target.y;

  field.speech.spoken.length = 0;
  field.field.fn.converse(target, 0);
  field.key('Escape');
  field.advance(5000);

  assert.equal(field.speech.spoken.length, 0, 'a queued reply must not survive the cancellation');
});

test('Escape during the queue delay stops the queued speaker', () => {
  const field = loadField();
  const first = selectFirst(field);
  const second = field.livingNodes().find((node) => node !== first && Math.hypot(node.x - first.x, node.y - first.y) > 120);
  field.press(second, { ctrlKey: true });
  assert.ok(field.field.speakQueue.length > 0 || field.field.selection.length === 2);

  field.field.speakQueue.length = 0;
  field.field.speakQueue.push(second);
  field.advance(40); // the first line finishes and schedules the queue
  field.speech.spoken.length = 0;

  field.key('Escape');
  field.advance(5000);

  assert.equal(field.speech.spoken.length, 0);
  assert.equal(field.field.speakQueue.length, 0, 'the queue belongs to the cancelled session');
});

test('a new selection after Escape speaks normally', () => {
  const field = loadField();
  const first = selectFirst(field);
  field.key('Escape');
  field.advance(2000);

  field.speech.spoken.length = 0;
  const second = field.livingNodes().find((node) => node !== first && Math.hypot(node.x - first.x, node.y - first.y) > 120);
  field.press(second);

  assert.equal(field.field.selected, second);
  assert.ok(field.speech.spoken.length > 0, 'the next selection must still be able to speak');
  assert.match(field.caption.textContent, /\S/);
  field.advance(4000);
  assert.ok(field.field.activeSpeech <= 1, 'exactly one voice at a time');
});

test('a stale completion cannot clear a caption that belongs to the next selection', () => {
  const field = loadField();
  const first = selectFirst(field);
  field.advance(5);
  field.key('Escape');

  const second = field.livingNodes().find((node) => node !== first && Math.hypot(node.x - first.x, node.y - first.y) > 120);
  field.press(second);
  const shown = field.caption.textContent;
  assert.match(shown, /\S/);

  field.advance(30); // the cancelled chain's callbacks land here
  assert.equal(field.field.selected, second);
  assert.match(field.caption.textContent, /\S/);
});
