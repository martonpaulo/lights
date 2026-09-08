// Regression cover for issue #13: the transit cooldown is simulation time, so it
// must not run faster because more doorways happen to be open.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const STEP = 0.016;

function fieldWithPortals(count) {
  const field = loadField();
  field.field.events = [];
  for (let i = 0; i < count; i++) {
    field.field.events.push({ type: 'portal', a: { x: 60 + i * 12, y: 60 }, b: { x: 1300 + i * 12, y: 800 }, r: 34, life: 16, age: 0 });
  }
  // One live light, parked far from every mouth, freshly out of a transit.
  const light = field.field.n[0];
  field.field.n.forEach((node, index) => { if (index) node.absent = 999; });
  light.absent = 0;
  light.x = 700;
  light.y = 450;
  light.vx = 0;
  light.vy = 0;
  light.portalCooldown = 0.9;
  return { field, light };
}

test('one simulation step consumes one step of cooldown, whatever the portal count', () => {
  for (const count of [0, 1, 5]) {
    const { field, light } = fieldWithPortals(count);
    field.field.fn.updateEvents();
    assert.ok(
      Math.abs(light.portalCooldown - (0.9 - STEP)) < 1e-6,
      `${count} portals left ${light.portalCooldown}, expected ${0.9 - STEP}`,
    );
  }
});

test('the same elapsed time leaves the same cooldown with zero, one or five portals', () => {
  const remaining = [0, 1, 5].map((count) => {
    const { field, light } = fieldWithPortals(count);
    for (let tick = 0; tick < 20; tick++) field.field.fn.updateEvents();
    return Math.round(light.portalCooldown * 1e6) / 1e6;
  });
  assert.equal(remaining[0], remaining[1]);
  assert.equal(remaining[0], remaining[2]);
  assert.ok(Math.abs(remaining[0] - (0.9 - 20 * STEP)) < 1e-6);
});

test('cooldown never runs below zero', () => {
  const { field, light } = fieldWithPortals(3);
  light.portalCooldown = 0.02;
  field.field.fn.updateEvents();
  field.field.fn.updateEvents();
  assert.equal(light.portalCooldown, 0);
});

test('a light that has just transited cannot be taken by a second doorway in the same tick', () => {
  const { field, light } = fieldWithPortals(0);
  // Two overlapping pairs share the mouth the light is sitting in.
  field.field.events = [
    { type: 'portal', a: { x: 700, y: 450 }, b: { x: 200, y: 200 }, r: 34, life: 16, age: 0 },
    { type: 'portal', a: { x: 700, y: 450 }, b: { x: 1200, y: 700 }, r: 34, life: 16, age: 0 },
  ];
  light.portalCooldown = 0;
  light.vx = 0.2;
  light.vy = 0;

  field.field.fn.updateEvents();

  // Exactly one doorway may claim it; the other must see the fresh cooldown.
  const exits = [Math.hypot(light.x - 200, light.y - 200), Math.hypot(light.x - 1200, light.y - 700)];
  const landed = exits.filter((distance) => distance < 60);
  assert.equal(landed.length, 1, `expected one transit, exit distances were ${exits}`);
  assert.ok(light.portalCooldown > 0.8, 'the fresh cooldown must survive the rest of the tick');
});

test('a reborn light does not inherit a transit cooldown', () => {
  const field = loadField();
  const light = field.field.n[0];
  light.portalCooldown = 0.9;
  field.field.fn.reborn(light, 0);
  assert.equal(light.portalCooldown || 0, 0);
});
