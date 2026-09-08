import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOKSTACK_RESET_CONTRACT, digestBookStackSeedSnapshot } from '../../src/bookstack-reset-state.mjs';

test('BookStack reset digest is stable across database output order', () => {
  const rows = 'pages|7|Welcome|welcome|3|\nusers|1|admin@example.test|Admin\nbooks|3|Public Book|public-book\n';
  const reordered = 'books|3|Public Book|public-book\npages|7|Welcome|welcome|3|\nusers|1|admin@example.test|Admin\n';
  assert.equal(BOOKSTACK_RESET_CONTRACT, 'bookstack-seeded-state-digest-v1');
  assert.equal(digestBookStackSeedSnapshot(rows), digestBookStackSeedSnapshot(reordered));
});

test('BookStack reset digest rejects unexpected snapshot rows', () => {
  assert.throws(() => digestBookStackSeedSnapshot('sessions|1|private\n'), /unexpected row type/);
});
