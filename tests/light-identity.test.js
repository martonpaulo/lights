// Regression cover for issue #18: the words for a light's trait reach the viewer.
// Colour already says the charge and the age implies the stage, so only the trait
// is named.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadField } from './harness.js';

const TRAIT_LABELS = ['Steady', 'Volatile', 'Easily overwhelmed', 'Single-minded', 'Restless', 'Self-regulating', 'Drained by company'];

function selectWith(field, wantTrait) {
  field.frame(10);
  const target = field.livingNodes().find((node) => (wantTrait ? node.trait : !node.trait));
  assert.ok(target, `no light ${wantTrait ? 'with' : 'without'} a trait`);
  field.press(target);
  return target;
}

test('a light with a trait is named by it beside its age', () => {
  const field = loadField();
  const target = selectWith(field, true);
  const credit = field.caption.children[0].children.find((child) => child.classList.contains('credit'));
  assert.ok(credit, 'the caption should carry a credit line');
  assert.match(credit.textContent, new RegExp(`^${target.name} · ${Math.floor(target.age)} · `));
  assert.ok(TRAIT_LABELS.includes(credit.textContent.split(' · ')[2]), `unexpected trait label in ${credit.textContent}`);
});

test('a light without a trait carries no empty separator', () => {
  const field = loadField();
  const target = selectWith(field, false);
  const credit = field.caption.children[0].children.find((child) => child.classList.contains('credit'));
  assert.equal(credit.textContent, `${target.name} · ${Math.floor(target.age)}`);
});

test('the field status reads the trait description out', () => {
  const field = loadField();
  field.frame(10);
  field.canvas.focus();
  field.canvas.dispatch('focus');
  const status = field.element('field-status');

  let guard = 0;
  while (!field.field.cursor.trait && guard++ < 60) field.canvas.dispatch('keydown', { key: 'ArrowRight' });
  assert.ok(field.field.cursor.trait, 'expected to reach a light with a trait');

  const label = TRAIT_LABELS.find((name) => status.textContent.includes(name));
  assert.ok(label, `no trait named in ${status.textContent}`);
  assert.match(status.textContent, new RegExp(`${label}: \\S`), 'the trait description must follow its name');
});

test('the trait survives a rebirth as one of the known ones', () => {
  const field = loadField();
  const target = field.field.n[0];
  for (let life = 0; life < 20; life++) {
    field.field.fn.reborn(target, 0);
    field.field.selection = [target];
    field.field.fn.speakNode(target, 'A line.', true);
    const credit = field.caption.children[0].children.find((child) => child.classList.contains('credit'));
    const parts = credit.textContent.split(' · ');
    assert.ok(parts.length === 2 || TRAIT_LABELS.includes(parts[2]), `unexpected credit ${credit.textContent}`);
  }
});
