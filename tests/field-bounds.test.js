// Regression cover for issue #6: a light always has a valid place to be. Shrinking
// the window, a drag released past an edge or a portal exit must not strand one
// outside the field, flipping its velocity forever.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

function inside(node, width, height) {
  const padX = Math.min(node.r, width / 2);
  const padY = Math.min(node.r, height / 2);
  return node.x >= padX - 1e-6 && node.x <= Math.max(padX, width - padX) + 1e-6
    && node.y >= padY - 1e-6 && node.y <= Math.max(padY, height - padY) + 1e-6;
}

function onlyOne(field) {
  field.field.n.forEach((node, index) => { if (index) node.absent = 999; });
  const light = field.field.n[0];
  light.absent = 0;
  light.vx = 0;
  light.vy = 0;
  return light;
}

test('a light left outside by a shrinking window comes back', () => {
  const field = loadField({ width: 1440, height: 900 });
  const light = onlyOne(field);
  light.x = 1000;
  light.y = 800;

  field.resize(500, 300);
  field.step(120);

  assert.ok(inside(light, 500, 300), `light stranded at ${light.x},${light.y}`);
});

test('every edge and corner recovers', () => {
  const width = 600;
  const height = 400;
  const outside = [[-50, 200], [width + 50, 200], [300, -50], [300, height + 50],
    [-50, -50], [width + 50, -50], [-50, height + 50], [width + 50, height + 50]];

  for (const [x, y] of outside) {
    const field = loadField({ width, height });
    const light = onlyOne(field);
    light.x = x;
    light.y = y;
    field.step(60);
    assert.ok(inside(light, width, height), `from ${x},${y} the light settled at ${light.x},${light.y}`);
  }
});

test('velocity only turns around when the light is still heading out', () => {
  const field = loadField({ width: 800, height: 600 });
  const light = onlyOne(field);
  light.x = 900;
  light.y = 300;
  light.vx = -0.2; // already on its way back

  field.field.fn.simulationStep();

  assert.ok(light.vx < 0, `an inbound light was turned around: vx=${light.vx}`);
  assert.ok(inside(light, 800, 600));
});

test('a window narrower than a light is survivable', () => {
  const field = loadField({ width: 1440, height: 900 });
  const light = onlyOne(field);
  light.r = 40;
  light.x = 700;
  light.y = 500;

  field.resize(20, 12);
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    field.step(1);
    assert.ok(Number.isFinite(light.x) && Number.isFinite(light.y), `position went to ${light.x},${light.y}`);
    assert.ok(Number.isFinite(light.vx) && Number.isFinite(light.vy));
    seen.add(`${Math.round(light.x)},${Math.round(light.y)}`);
  }
  assert.ok(seen.size <= 2, `a trapped light kept jittering across ${seen.size} places`);
});

test('a drag released past an edge does not strand the light', () => {
  const field = loadField({ width: 800, height: 600 });
  field.frame(5);
  const light = field.livingNodes()[0];
  field.press(light);
  field.canvas.dispatch('pointermove', { pointerId: 1, clientX: 2000, clientY: 1500 });
  field.canvas.dispatch('pointerup', { pointerId: 1 });
  field.step(30);

  assert.ok(inside(light, 800, 600), `released at ${light.x},${light.y}`);
});

test('a portal exit lands inside the field', () => {
  const field = loadField({ width: 800, height: 600 });
  const light = onlyOne(field);
  light.x = 60;
  light.y = 60;
  light.vx = 2;
  light.vy = 2;
  light.portalCooldown = 0;
  field.field.events = [{ type: 'portal', a: { x: 60, y: 60 }, b: { x: 795, y: 595 }, r: 34, life: 16, age: 0 }];

  field.field.fn.simulationStep();

  assert.ok(inside(light, 800, 600), `portal exit put the light at ${light.x},${light.y}`);
});

test('resizing keeps identities, selection and relationships', () => {
  const field = loadField({ width: 1440, height: 900 });
  field.frame(10);
  const target = field.livingNodes()[0];
  field.press(target);
  const name = target.name;
  field.field.regard[0 * 64 + 3] = 0.5; // exactly representable in a Float32Array

  field.resize(420, 700);
  field.step(40);

  assert.equal(field.field.selected, target);
  assert.equal(target.name, name);
  assert.equal(field.field.regard[0 * 64 + 3], 0.5);
  assert.equal(field.field.n.length, 40);
});
