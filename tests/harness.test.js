import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

test('the field boots with forty lights and a drawing surface', () => {
  const field = loadField();
  assert.equal(field.field.n.length, 40);
  assert.equal(field.canvas.width, 1440);
  assert.equal(field.canvas.height, 900);
  assert.deepEqual(field.errors, []);
});

test('the world advances while frames are drawn', () => {
  const field = loadField();
  const before = field.field.n.map((node) => `${node.x},${node.y}`).join('|');
  field.frame(30);
  const after = field.field.n.map((node) => `${node.x},${node.y}`).join('|');
  assert.notEqual(before, after);
});
