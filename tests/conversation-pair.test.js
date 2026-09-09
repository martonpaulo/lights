// Regression cover for issue #10: only selected lights speak, and a reply comes
// from the other half of the selected pair rather than from a twin or a neighbour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

/** Selects two lights that are far apart and are not each other's twins. */
function selectPair(field) {
  field.frame(10);
  const [first, second, outsider] = field.field.n;
  field.field.n.forEach((node) => { node.twin = null; node.absent = 0; });
  field.field.e = [];
  first.x = 200; first.y = 200;
  second.x = 1200; second.y = 700;
  // The selected speaker's twin and nearest neighbour are both outside the selection.
  outsider.x = 220; outsider.y = 210;
  first.twin = 2;
  outsider.twin = 0;

  field.press(first);
  field.press(second, { ctrlKey: true });
  return { first, second, outsider };
}

test('the reply comes from the other selected light, not a twin or a neighbour', () => {
  const field = loadField();
  const { first, second, outsider } = selectPair(field);
  assert.equal(field.field.selection.length, 2);

  const partner = field.field.fn.replyPartner(field.field.selected);
  assert.ok(field.field.selection.includes(partner), 'the partner must be part of the selection');
  assert.notEqual(partner, outsider);
  assert.equal(partner, field.field.selected === first ? second : first);
});

test('an unselected light never speaks', () => {
  const field = loadField();
  const { first, outsider } = selectPair(field);

  field.field.fn.speakNode(outsider, 'I was not invited.', true);
  assert.notEqual(field.field.lastCaption && field.field.lastCaption.node, outsider);
  assert.ok(!field.caption.textContent.includes('I was not invited'));

  field.field.fn.converse(outsider, 0);
  field.advance(4000);
  assert.ok(field.field.selection.includes(field.field.lastCaption.node), 'the last speaker must be selected');
  assert.ok(first);
});

test('a single selected light draws no unsolicited partner in', () => {
  const field = loadField();
  field.frame(10);
  const alone = field.field.n[0];
  const neighbour = field.field.n[1];
  field.field.n.forEach((node) => { node.twin = null; });
  alone.x = 400; alone.y = 400;
  neighbour.x = 420; neighbour.y = 410;
  field.press(alone);
  assert.equal(field.field.selection.length, 1);

  assert.equal(field.field.fn.replyPartner(alone), null);
  field.field.fn.converse(alone, 0);
  field.advance(4000);
  assert.equal(field.field.lastCaption.node, alone);
});

test('changing the selection during a reply delay cancels the reply', () => {
  const field = loadField();
  const { first, second } = selectPair(field);
  field.field.fn.converse(field.field.selected, 0);

  // Drop the partner while its answer is still pending.
  field.press(second, { ctrlKey: true });
  const speaker = field.field.selected;
  field.advance(5000);

  assert.ok(field.field.selection.includes(field.field.lastCaption.node));
  assert.ok(speaker === first || speaker === second);
});

test('an absent partner is not asked to answer', () => {
  const field = loadField();
  const { first, second } = selectPair(field);
  const speaker = field.field.selected === first ? first : second;
  const other = speaker === first ? second : first;
  other.absent = 12;

  assert.equal(field.field.fn.replyPartner(speaker), null);
  field.field.fn.converse(speaker, 0);
  field.advance(5000);
  assert.notEqual(field.field.lastCaption.node, other);
});

test('the selection never grows past two and only one voice speaks', () => {
  const field = loadField();
  selectPair(field);
  const third = field.field.n[7];
  third.x = 700; third.y = 400;
  field.press(third, { ctrlKey: true });

  assert.equal(field.field.selection.length, 2);
  field.advance(6000);
  assert.ok(field.field.activeSpeech <= 1);
});
