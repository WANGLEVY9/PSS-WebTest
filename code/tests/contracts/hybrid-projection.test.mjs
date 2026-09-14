import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeHybridProjection } from '../../src/arms/hybrid-projection.mjs';

test('canonical hybrid projection preserves only declared visible-interactable fields', () => {
  assert.deepEqual(canonicalizeHybridProjection({
    controls: [{
      target_id: 'c12', role: 'textbox', name: 'Search', placeholder: 'Search products',
      state: { disabled: false, expanded: false },
      bounding_box: { x: 12, y: 20, width: 150, height: 30 },
      center_normalized_1000: { x: 117, y: 48 }
    }]
  }), {
    controls: [{
      target_id: 'c12', role: 'textbox', name: 'Search', interaction: 'type', placeholder: 'Search products',
      state: { disabled: false, expanded: false },
      bounding_box: { x: 12, y: 20, width: 150, height: 30 },
      center_normalized_1000: { x: 117, y: 48 }
    }]
  });
});

test('canonical hybrid projection rejects raw trees, selectors, URLs, and stable identifiers', () => {
  for (const pageStructure of [
    { role: 'main', children: [] },
    { controls: [{ target_id: 'c1', role: 'button', name: 'Save', selector: '#save' }] },
    { controls: [{ target_id: 'c1', role: 'button', name: 'Save', url: 'https://sut.example/private' }] },
    { controls: [{ target_id: 'c1', role: 'button', name: 'Save', stable_id: 'application-42' }] }
  ]) {
    assert.throws(() => canonicalizeHybridProjection(pageStructure), /forbidden fields/);
  }
});

test('canonical hybrid projection requires bounded unique ephemeral target ids', () => {
  assert.throws(() => canonicalizeHybridProjection({ controls: [{ target_id: 'button-1', role: 'button', name: 'Save' }] }), /target_id/);
  assert.throws(() => canonicalizeHybridProjection({ controls: [
    { target_id: 'c1', role: 'button', name: 'Save' },
    { target_id: 'c1', role: 'link', name: 'Cancel' }
  ] }), /unique target_id/);
});
