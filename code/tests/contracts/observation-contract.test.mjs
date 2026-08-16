import assert from 'node:assert/strict';
import test from 'node:test';

import { assertObservationContract } from '../../src/arms/observation-contracts.mjs';

test('pure-visual arm admits screenshots and interaction metadata', () => {
  const result = assertObservationContract('visual', {
    screenshot: 'sha256:example',
    viewport: { width: 1280, height: 720 }
  });
  assert.equal(result.observationContract, 'screenshot-only');
});

test('pure-visual arm rejects DOM leakage', () => {
  assert.throws(
    () => assertObservationContract('visual', { screenshot: 'sha256:example', dom: '<main />' }),
    /"leaked":\["dom"\]/
  );
});

test('pure-visual arm rejects hybrid structure and hidden evaluator fields', () => {
  for (const leakedField of ['pageStructure', 'accessibilityTree', 'goldOracle', 'mutationLabel']) {
    assert.throws(
      () => assertObservationContract('visual', { screenshot: 'sha256:example', [leakedField]: {} }),
      new RegExp(leakedField)
    );
  }
});

test('contracts reject undeclared observation fields', () => {
  assert.throws(
    () => assertObservationContract('hybrid', { screenshot: 'x', pageStructure: {}, rawHtml: '<main />' }),
    /rawHtml/
  );
});

test('hybrid arm requires both screenshot and declared structure', () => {
  assert.throws(
    () => assertObservationContract('hybrid', { screenshot: 'sha256:example' }),
    /pageStructure/
  );
});

test('no arm may receive the hidden gold oracle', () => {
  for (const [arm, observation] of [
    ['hybrid', { screenshot: 'x', pageStructure: {}, goldOracle: true }],
    ['playwright', { scriptId: 'bookstack-create-page', goldOracle: true }]
  ]) {
    assert.throws(() => assertObservationContract(arm, observation), /goldOracle/);
  }
});
