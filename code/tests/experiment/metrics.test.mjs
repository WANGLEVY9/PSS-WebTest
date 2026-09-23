import test from "node:test";
import assert from "node:assert/strict";
import { assess, summarize } from "../../experiment/metrics.mjs";
import {tokenLabel,reportedTotal} from '../../console/public/resource-accounting.mjs';
test('partial and absent provider usage are not reported as complete totals',()=>{
  const s=summarize([{arm:'visual',finished_at:'now',requests:[{usage:{total_tokens:4}},{usage:null}]}])[0];
  assert.equal(s.tokens,null);assert.equal(s.token_accounting.reported_subtotal,4);assert.equal(s.token_accounting.coverage,.5);assert.equal(s.latency_ms,null);
  assert.equal(tokenLabel([{usage:null}]),'Unavailable');assert.equal(tokenLabel([{usage:{total_tokens:4}},{}]),'4 (partial)');
  assert.equal(tokenLabel([]),'0');assert.equal(reportedTotal([NaN,Infinity,-1]).total,null);
});
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
