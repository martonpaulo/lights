// Regression cover for issue #5: the fixed 16 ms step owns world state and the
// animation frame only draws it. Equal simulation input must give equal world,
// whatever the drawing cadence.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

/** A constant source removes chance, so only the loops decide the outcome. */
const FLAT = () => 0.5;

function world(field) {
  return {
    t: field.field.t,
    nodes: field.field.n.map((node) => [node.x, node.y, node.vx, node.vy, node.absent, node.twin].join(',')).join('|'),
    bonds: field.field.e.map((bond) => `${bond.a}-${bond.b}@${bond.age.toFixed(6)}/${bond.life}`).join('|'),
  };
}

test('drawing a frame does not move the world', () => {
  const field = loadField();
  field.frame(5);
  const before = world(field);

  field.drawOnly(20); // frames only; the fixed step is never allowed to run

  assert.deepEqual(world(field), before, 'a draw call changed world state');
});

test('equal simulation steps give an equal world at any drawing cadence', () => {
  const runs = [0, 1, 4].map((drawEvery) => {
    const field = loadField({ random: FLAT, autoStart: false });
    for (let i = 0; i < 300; i++) {
      field.step(1);
      if (drawEvery && i % drawEvery === 0) field.drawOnly(1);
    }
    return world(field);
  });

  assert.deepEqual(runs[1], runs[0]);
  assert.deepEqual(runs[2], runs[0]);
  assert.ok(runs[0].nodes.length > 0);
});

test('world time counts simulation steps, not frames', () => {
  const field = loadField({ random: FLAT, autoStart: false });
  field.drawOnly(50);
  assert.equal(field.field.t, 0, 'frames must not advance world time');

  field.step(25);
  assert.ok(Math.abs(field.field.t - 25 * 0.08) < 1e-9);
});

test('bond lifetime is spent by the simulation, not by the renderer', () => {
  const field = loadField({ random: FLAT, autoStart: false });
  field.field.e = [{ a: 0, b: 1, age: 0, life: 60 }];

  field.drawOnly(30);
  assert.equal(field.field.e[0].age, 0);

  field.step(10);
  assert.ok(Math.abs(field.field.e[0].age - 10 * 0.08) < 1e-9);
});

test('blast rings and bond flashes expire on simulation time', () => {
  const field = loadField({ random: FLAT, autoStart: false });
  field.field.bombs = [{ x: 100, y: 100, r: 200, age: 0, power: 1 }];
  field.field.bonds = [{ x: 50, y: 50, age: 0 }];

  field.drawOnly(40);
  assert.equal(field.field.bombs.length, 1, 'drawing must not consume a blast ring');
  assert.equal(field.field.bonds.length, 1);

  field.step(70);
  assert.equal(field.field.bombs.length, 0);
  assert.equal(field.field.bonds.length, 0);
});

test('the world still moves, drags, detonates and speaks after the split', () => {
  const field = loadField();
  const before = field.field.n.map((node) => `${node.x},${node.y}`).join('|');
  field.frame(60);
  assert.notEqual(before, field.field.n.map((node) => `${node.x},${node.y}`).join('|'));

  const target = field.livingNodes()[0];
  field.press(target);
  assert.equal(field.field.dragged, target);
  field.canvas.dispatch('pointermove', { pointerId: 1, clientX: 600, clientY: 400 });
  field.frame(10);
  assert.ok(Math.hypot(target.x - 600 + field.field.camX, target.y - 400 + field.field.camY) < 200);
  field.canvas.dispatch('pointerup', { pointerId: 1 });

  field.field.bombs = [];
  field.pressAt(30, 30);
  assert.equal(field.field.bombs.length, 1);
  field.field.fn.spawnPortals(300, 300);
  field.frame(30);
  assert.match(field.caption.textContent, /\S/);
  assert.deepEqual(field.errors, []);
});
