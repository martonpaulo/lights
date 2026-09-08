// Regression cover for issue #11: a secondary press belongs to the context menu.
// It must not detonate, select, or start a drag on its way there.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const SECONDARY = { button: 2, buttons: 2 };

test('a right press on empty space does not detonate', () => {
  const field = loadField();
  field.frame(10);
  field.field.bombs = [];

  field.pressAt(1200, 100, SECONDARY);

  assert.equal(field.field.bombs.length, 0);
  assert.equal(field.field.selected, null);
  assert.equal(field.field.dragged, null);
});

test('a right press near a light selects nothing and starts no drag', () => {
  const field = loadField();
  field.frame(10);
  const target = field.livingNodes()[0];

  field.press(target, SECONDARY);

  assert.equal(field.field.selected, null);
  assert.equal(field.field.selection.length, 0);
  assert.equal(field.field.dragged, null);
  assert.equal(field.canvas.captured.size, 0, 'no pointer capture for a press we ignore');
});

test('a right press on a summon does not grab it', () => {
  const field = loadField();
  field.field.fn.spawnAttractor(400, 400);
  const summon = field.field.events.at(-1);

  field.pressAt(summon.x, summon.y, SECONDARY);

  assert.equal(field.field.selectedEvent, null);
  assert.equal(field.field.draggedEvent, null);
});

test('the context menu opens on a right press and closes without side effects', () => {
  const field = loadField();
  field.frame(10);
  field.field.bombs = [];
  const menu = field.element('summon-menu');

  field.canvas.dispatch('contextmenu', { clientX: 1200, clientY: 120, ...SECONDARY });
  assert.ok(menu.classList.contains('open'));

  field.window.dispatch('pointerdown', { target: field.canvas, ...SECONDARY });
  assert.ok(!menu.classList.contains('open'));
  assert.equal(field.field.bombs.length, 0);
  assert.equal(field.field.selected, null);
});

test('choosing a menu command creates only that summon', () => {
  const field = loadField();
  field.field.events = [];
  field.canvas.dispatch('contextmenu', { clientX: 600, clientY: 400, ...SECONDARY });
  const menu = field.element('summon-menu');
  const comet = menu.children.find((button) => button.dataset.summon === 'comet');
  menu.dispatch('click', { target: comet });

  assert.equal(field.field.events.length, 1);
  assert.equal(field.field.events[0].type, 'comet');
  assert.equal(field.field.bombs.length, 0);
});

test('the primary press keeps selecting, stacking and detonating', () => {
  const field = loadField();
  field.frame(10);
  const first = field.livingNodes()[0];
  field.press(first);
  assert.equal(field.field.selected, first);
  assert.equal(field.field.dragged, first);

  const second = field.livingNodes().find((node) => node !== first && Math.hypot(node.x - first.x, node.y - first.y) > 120);
  field.press(second, { ctrlKey: true });
  assert.equal(field.field.selection.length, 2);

  field.field.bombs = [];
  field.pressAt(20, 20);
  assert.equal(field.field.bombs.length, 1);
});
