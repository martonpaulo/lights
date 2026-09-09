// Regression cover for issue #3: every field action is reachable without a
// pointer, and the field says what the cursor is on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const key = (field, name, extra = {}) => field.canvas.dispatch('keydown', { key: name, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra });

function focusField(field) {
  field.frame(10);
  field.canvas.focus();
  field.canvas.dispatch('focus');
  return field.element('field-status');
}

test('the field is focusable and names what the cursor is on', () => {
  const field = loadField();
  const status = focusField(field);

  assert.equal(field.canvas.getAttribute('tabindex'), '0');
  assert.equal(field.canvas.getAttribute('role'), 'application');
  assert.ok(field.field.cursor, 'focusing the field must put the cursor somewhere');
  assert.match(status.textContent, new RegExp(field.field.cursor.name));
  assert.match(status.textContent, new RegExp(field.field.cursor.personality));
});

test('arrow keys walk the cursor through the living lights only', () => {
  const field = loadField();
  const status = focusField(field);
  field.field.n[3].absent = 14;
  field.field.n[9].absent = 9;

  const visited = new Set();
  for (let i = 0; i < 12; i++) {
    key(field, 'ArrowRight');
    visited.add(field.field.cursor);
    assert.ok(!field.field.cursor.absent, 'the cursor must never land on an empty slot');
  }
  assert.ok(visited.size > 4, `the cursor barely moved: ${visited.size} places`);

  const forward = field.field.cursor;
  key(field, 'ArrowLeft');
  key(field, 'ArrowRight');
  assert.equal(field.field.cursor, forward, 'stepping back and forward must return to the same light');
  assert.match(status.textContent, /\S/);
});

test('Enter selects, Shift and Enter holds a second, and two is the limit', () => {
  const field = loadField();
  focusField(field);

  key(field, 'ArrowRight');
  const first = field.field.cursor;
  key(field, 'Enter');
  assert.equal(field.field.selected, first);
  assert.equal(field.field.selection.length, 1);
  assert.match(field.caption.textContent, /\S/);

  key(field, 'ArrowRight');
  const second = field.field.cursor;
  key(field, 'Enter', { shiftKey: true });
  assert.deepEqual([...field.field.selection], [first, second]);

  key(field, 'ArrowRight');
  key(field, 'Enter', { shiftKey: true });
  assert.equal(field.field.selection.length, 2, 'the field holds at most two');

  // Shift and Enter on a held light lets it go again.
  const held = field.field.selection[0];
  while (field.field.cursor !== held) key(field, 'ArrowRight');
  key(field, 'Enter', { shiftKey: true });
  assert.ok(!field.field.selection.includes(held));
});

test('the status line reports the selected state', () => {
  const field = loadField();
  const status = focusField(field);
  key(field, 'ArrowRight');
  assert.ok(!/selected/.test(status.textContent));
  key(field, 'Enter');
  assert.match(status.textContent, /selected/);
});

test('Escape clears the selection from the keyboard', () => {
  const field = loadField();
  focusField(field);
  key(field, 'ArrowRight');
  key(field, 'Enter');
  assert.ok(field.field.selected);

  field.window.dispatch('keydown', { key: 'Escape' });
  assert.equal(field.field.selected, null);
  assert.equal(field.field.selection.length, 0);
});

test('Shift and the arrows move a light, in place of dragging', () => {
  const field = loadField();
  focusField(field);
  key(field, 'ArrowRight');
  const light = field.field.cursor;
  const from = { x: light.x, y: light.y };

  key(field, 'ArrowRight', { shiftKey: true });
  key(field, 'ArrowDown', { shiftKey: true });

  assert.equal(field.field.cursor, light, 'moving must not also step the cursor');
  assert.ok(light.x > from.x, `x did not move: ${from.x} -> ${light.x}`);
  assert.ok(light.y > from.y, `y did not move: ${from.y} -> ${light.y}`);
  assert.ok(light.x <= field.canvas.clientWidth && light.y <= field.canvas.clientHeight);
});

test('B detonates at the cursor', () => {
  const field = loadField();
  focusField(field);
  key(field, 'ArrowRight');
  field.field.bombs = [];

  key(field, 'b');

  assert.equal(field.field.bombs.length, 1);
  assert.ok(Math.hypot(field.field.bombs[0].x - field.field.cursor.x, field.field.bombs[0].y - field.field.cursor.y) < 1);
});

test('S opens the summon group, which summons and returns focus', () => {
  const field = loadField();
  focusField(field);
  key(field, 'ArrowRight');
  field.field.events = [];
  const menu = field.element('summon-menu');

  key(field, 's');
  assert.ok(menu.classList.contains('open'));
  assert.equal(menu.getAttribute('role'), 'group');
  assert.equal(field.document.activeElement, menu.children[0], 'the first command must take focus');

  menu.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(field.document.activeElement, menu.children[1]);

  const portal = menu.children.find((button) => button.dataset.summon === 'portal');
  menu.dispatch('click', { target: portal });
  assert.equal(field.field.events.length, 1);
  assert.equal(field.field.events[0].type, 'portal');
  assert.ok(!menu.classList.contains('open'));
  assert.equal(field.document.activeElement, field.canvas, 'focus must come back to the field');
});

test('Escape closes the summon group without clearing the selection', () => {
  const field = loadField();
  focusField(field);
  key(field, 'ArrowRight');
  key(field, 'Enter');
  const held = field.field.selected;

  key(field, 's');
  const menu = field.element('summon-menu');
  assert.ok(menu.classList.contains('open'));

  field.window.dispatch('keydown', { key: 'Escape' });

  assert.ok(!menu.classList.contains('open'));
  assert.equal(field.document.activeElement, field.canvas);
  assert.equal(field.field.selected, held, 'closing the menu is not clearing the selection');
});

test('summons join the cursor ring and leave it when they expire', () => {
  const field = loadField();
  focusField(field);
  field.field.events = [];
  const before = field.field.fn.navigationRing().length;

  field.field.fn.spawnAttractor(400, 400);
  assert.equal(field.field.fn.navigationRing().length, before + 1);

  const summon = field.field.events[0];
  while (field.field.cursor !== summon) key(field, 'ArrowRight');
  key(field, 'ArrowRight', { shiftKey: true });
  assert.ok(summon.x > 400, 'a summon must be movable from the keyboard');

  field.field.events = [];
  key(field, 'ArrowRight');
  assert.ok(field.field.cursor && !field.field.cursor.type, 'an expired summon must not keep the cursor');
});

test('the audio controls keep their own keyboard behaviour', () => {
  const field = loadField();
  focusField(field);
  const slider = field.element('volume');
  slider.focus();
  const seen = [];
  slider.addEventListener('keydown', (event) => seen.push(event.key));

  slider.dispatch('keydown', { key: 'ArrowRight' });
  assert.deepEqual(seen, ['ArrowRight']);
  assert.equal(field.document.activeElement, slider, 'the field must not steal focus back');
});

test('the cursor leaves a light that goes dark', () => {
  const field = loadField();
  focusField(field);
  key(field, 'ArrowRight');
  const light = field.field.cursor;
  const status = field.element('field-status');

  light.dying = 1;
  light.fade = 0.99;
  field.advance(1000);
  assert.ok(light.absent > 0);

  key(field, 'ArrowRight');
  assert.notEqual(field.field.cursor, light, 'the cursor must not sit on an empty slot');
  assert.ok(!field.field.cursor.absent);
  assert.ok(!status.textContent.includes(light.name) || field.field.cursor.name === light.name);
});
