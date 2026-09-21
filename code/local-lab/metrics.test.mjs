import test from "node:test";
import assert from "node:assert/strict";
import { assess, summarize } from "./metrics.mjs";
test("oracle reach without valid completion is not strict success", () =>
  assert.deepEqual(
    assess({
      completed: false,
      oracle: { passed: true },
      failure_class: "step-budget",
    }),
    { strict_pass: false, operational_correctness: 0 },
  ));
test("evaluator/reset errors stay unresolved", () =>
  assert.equal(
    assess({
      completed: true,
      oracle: { passed: true },
      failure_class: "reset",
    }).operational_correctness,
    null,
  ));
test("completed verified run passes", () =>
  assert.equal(
    assess({ completed: true, oracle: { passed: true } }).strict_pass,
    true,
  ));
test("native score and cost are never invented", () => {
  const s = summarize([
    {
      arm: "visual",
      finished_at: "now",
      strict_pass: false,
      oracle: { passed: false },
      operational_correctness: 0,
      requests: [{ usage: { total_tokens: 45 } }],
    },
  ])[0];
  assert.equal(s.tokens, 45);
  assert.equal(s.native_benchmark_score, null);
  assert.equal(s.cost_usd, null);
  assert.equal(s.scheduled, 1);
  assert.equal(s.passed, 0);
});
