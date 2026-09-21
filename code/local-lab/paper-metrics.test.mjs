import test from "node:test";
import assert from "node:assert/strict";
import {
  wavTemplateMacro,
  ataMetrics,
  operationalBounds,
  retryComplementarity,
} from "./paper-metrics.mjs";
test("WAV uses template macro not task micro", () =>
  assert.equal(
    wavTemplateMacro([
      { template_id: 1, success: 1 },
      { template_id: 1, success: 1 },
      { template_id: 2, success: 0 },
    ]).score,
    0.5,
  ));
test("ATA positive class is FAIL and missing verdict is separate", () => {
  const x = ataMetrics([
    { expected: "FAIL", verdict: "FAIL" },
    { expected: "PASS", verdict: "FAIL" },
    { expected: "PASS", verdict: null },
  ]);
  assert.equal(x.TP, 1);
  assert.equal(x.FP, 1);
  assert.equal(x.accuracy, 0.5);
  assert.equal(x.binary_coverage, 2 / 3);
});
test("unprepared zero remains; unresolved creates identification bounds", () =>
  assert.deepEqual(operationalBounds([1, 0, null, 0]), {
    n: 4,
    lower: 0.25,
    upper: 0.5,
    unresolved: 1,
  }));
test("retry controls use same complete blocks", () => {
  const x = retryComplementarity([
    { c1: 1, c2: 0, d1: 0, d2: 1 },
    { c1: null, c2: 0, d1: 1, d2: 1 },
  ]);
  assert.equal(x.n, 1);
  assert.equal(x.mixed, 0.5);
  assert.equal(x.cc, 1);
  assert.equal(x.dd, 1);
  assert.equal(x.margin, -0.5);
});
