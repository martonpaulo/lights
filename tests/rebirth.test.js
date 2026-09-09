// Regression cover for issue #7: a slot that fills again starts a new life, not a
// continuation of the old one. Aged movement, transient forces and pair history
// must not survive the handover.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

/** The ranges a first life is created with, from the node literal in rs(). */
const FIRST_LIFE = {
  wanderForce: [0.0022, 0.0057],
  wanderTurn: [0.12, 0.42],
  twinkleSpeed: [0.7, 2.3],
  twinkleDepth: [0.35, 0.8],
  rhythmSpeed: [0.25, 0.75],
  lumen: [0.6, 1.2],
  lumenTo: [0.35, 1.5],
  nextImpulse: [2, 16],
};

function assertFirstLife(node, note) {
  for (const [name, [low, high]] of Object.entries(FIRST_LIFE)) {
    assert.ok(node[name] >= low && node[name] <= high, `${note}: ${name} was ${node[name]}, outside ${low}..${high}`);
  }
  assert.equal(node.boost || 0, 0, `${note}: inherited a blast boost`);
  assert.equal(node.portalCooldown || 0, 0, `${note}: inherited a transit cooldown`);
  assert.equal(node.edgeContact || false, false, `${note}: inherited edge contact`);
  assert.equal(node.fade, 0, `${note}: a new life must be able to fade out gradually later`);
  assert.equal(node.dying, 0, `${note}: arrived already dying`);
  assert.equal(node.absent, 0, `${note}: arrived absent`);
  assert.equal(node.stage, 0, `${note}: arrived at a later life stage`);
  assert.equal(node.twin, null, `${note}: inherited an entanglement`);
  assert.equal(node.friend, null, `${note}: inherited a friend`);
  assert.equal(node.rival, null, `${note}: inherited a rival`);
  assert.equal(node.regardIn || 0, 0, `${note}: inherited standing`);
  assert.equal(node.reputation || 0, 0, `${note}: inherited a reputation`);
  assert.equal(node.trained, 0, `${note}: inherited a trained model`);
  assert.ok([...node.weights].every((weight) => weight === 0), `${note}: inherited learned weights`);
}

/** Runs a light through its whole life so the ageing attenuations accumulate. */
function ageOut(field, node) {
  node.age = 17;
  node.lifespan = 70;
  for (let year = 0; year < 90 && !node.absent; year++) field.advance(1000);
  return node;
}

test('a reborn light starts from the same baseline a first life is created with', () => {
  const field = loadField();
  const node = field.field.n[0];

  ageOut(field, node);
  node.boost = 5;
  node.portalCooldown = 0.9;
  node.edgeContact = true;
  node.regardIn = 0.8;

  field.field.fn.reborn(node, 0);
  assertFirstLife(node, 'first rebirth');
});

test('ageing attenuation does not accumulate across lives', () => {
  const field = loadField();
  const node = field.field.n[0];

  ageOut(field, node);
  field.field.fn.reborn(node, 0);
  const afterOne = { wanderForce: node.wanderForce, twinkleSpeed: node.twinkleSpeed };

  ageOut(field, node);
  field.field.fn.reborn(node, 0);
  assertFirstLife(node, 'second rebirth');

  // Both lives must land in the same range, not a progressively quieter one.
  assert.ok(node.wanderForce > afterOne.wanderForce * 0.2);
  assert.ok(node.twinkleSpeed > afterOne.twinkleSpeed * 0.2);
});

test('a reborn light dies gradually rather than blinking out', () => {
  const field = loadField();
  const node = field.field.n[0];
  field.field.fn.reborn(node, 0);

  node.age = node.lifespan + 1;
  field.advance(1000);
  assert.equal(node.dying, 1);

  const fades = [];
  for (let tick = 0; tick < 4 && !node.absent; tick++) {
    field.advance(1000);
    fades.push(node.fade);
  }
  assert.ok(fades.length >= 3, `expected a gradual fade, saw ${fades.length} step(s): ${fades}`);
  assert.ok(fades[0] < 1 && fades[0] > 0, `the first fade step was ${fades[0]}`);
});

test('pair history and entanglement do not survive a rebirth', () => {
  const field = loadField();
  const [first, second] = field.field.n;

  field.field.affinity[0 * 64 + 1] = 0.9;
  field.field.regard[0 * 64 + 1] = -0.7;
  field.field.regard[0 * 64 + 5] = 0.5;
  field.field.encounters.set(1, { at: 0.5 }); // pairKey(0, 1)
  first.twin = 1;
  second.twin = 0;
  field.field.e = [{ a: 0, b: 1, age: 0, life: 60 }];

  field.field.fn.reborn(first, 0);

  assert.equal(field.field.affinity[0 * 64 + 1], 0);
  assert.equal(field.field.regard[0 * 64 + 1], 0);
  assert.equal(field.field.regard[0 * 64 + 5], 0);
  // pairKey(0, j) is always below 64, so any surviving key must belong to another pair.
  assert.ok([...field.field.encounters.keys()].every((key) => key >= 64), 'open encounters with the departed light must be dropped');
  assert.equal(second.twin, null, 'the partner must be released too');
  assert.equal(field.field.e.length, 0);
});

test('a rebirth releases a light that was being dragged or selected', () => {
  const field = loadField();
  field.frame(10);
  const node = field.livingNodes()[0];
  field.press(node);
  assert.equal(field.field.dragged, node);
  assert.equal(field.field.selected, node);

  field.field.fn.reborn(node, field.field.n.indexOf(node));

  assert.equal(field.field.selected, null);
  assert.equal(field.field.selection.length, 0);
  assert.equal(field.field.dragged, null, 'a light that no longer exists cannot still be held');
});
