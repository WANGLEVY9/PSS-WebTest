import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentAdapter } from '../../src/arms/agent-adapter.mjs';
import { assertObservationContract } from '../../src/arms/observation-contracts.mjs';

const accessibilitySnapshot = {
  role: 'main',
  name: 'BookStack page editor',
  children: [
    { role: 'textbox', name: 'Page title', ref: 'node-1' },
    { role: 'button', name: 'Save page', ref: 'node-2', disabled: false }
  ]
};

test('hybrid contract admits screenshot plus declared accessibility structure', () => {
  const result = assertObservationContract('hybrid', {
    screenshot: 'sha256:screen',
    pageStructure: accessibilitySnapshot,
    structureSchema: 'accessibility-tree-v1',
    viewport: { width: 1280, height: 720 }
  });
  assert.equal(result.observationContract, 'screenshot-plus-structure');
  assert.deepEqual(result.admittedFields, ['pageStructure', 'screenshot', 'structureSchema', 'viewport']);
});

test('hybrid contract rejects hidden oracle fields nested in page structure', () => {
  for (const field of ['goldOracle', 'applicationState', 'mutationLabel']) {
    assert.throws(
      () => assertObservationContract('hybrid', {
        screenshot: 'sha256:screen',
        pageStructure: { ...accessibilitySnapshot, children: [{ role: 'button', [field]: 'hidden' }] }
      }),
      new RegExp(`"${field}"`)
    );
  }
});

test('hybrid adapter passes only admitted screenshot/structure to the decision driver', async () => {
  let decidedObservation;
  const adapter = createAgentAdapter({
    arm: 'hybrid',
    maxSteps: 2,
    driver: {
      async observe() {
        return { screenshot: 'sha256:screen', pageStructure: accessibilitySnapshot };
      },
      async decide({ observation }) {
        decidedObservation = observation;
        return { type: 'done', verdict: 'pass' };
      },
      async act() {}
    }
  });
  const result = await adapter.run({ intent: 'Save the page.' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(Object.keys(decidedObservation).sort(), ['pageStructure', 'screenshot']);
  assert.equal('goldOracle' in decidedObservation, false);
  assert.equal('applicationState' in decidedObservation, false);
});
