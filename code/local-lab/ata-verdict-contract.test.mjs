import test from "node:test";
import assert from "node:assert/strict";
import { scoreAta } from "./ata-verdict-contract.mjs";
test("ATA failure is positive class; predicted status is not gold", () => {
  const r = scoreAta([
    { gold: "F", predicted: "FAIL", step: 3, expected_step: 3 },
    { gold: "P", predicted: "PASS" },
    { gold: "F", predicted: "PASS" },
    { gold: "P", predicted: "FAIL" },
  ]);
  assert.equal(r.TP, 1);
  assert.equal(r.TN, 1);
  assert.equal(r.FP, 1);
  assert.equal(r.FN, 1);
  assert.equal(r.conditional_verdict_accuracy, 0.5);
  assert.equal(r.sensitivity, 0.5);
  assert.equal(r.specificity, 0.5);
});
test("premature/late failure is not exact failure-step correctness", () => {
  const r = scoreAta(
    [1, 2, 3].map((step) => ({
      gold: "F",
      predicted: "FAIL",
      step,
      expected_step: 2,
    })),
  );
  assert.equal(r.AFB, 1);
  assert.equal(r.AFC, 1);
  assert.equal(r.AFA, 1);
  assert.equal(r.strict_step_accuracy, 1 / 3);
  assert.equal(r.SMER, 2 / 3);
});
test("missing verdict is retained, never coerced to PASS or FAIL", () => {
  const r = scoreAta([
    { gold: "P", predicted: "PASS" },
    { gold: "F", predicted: null },
  ]);
  assert.equal(r.missing, 1);
  assert.equal(r.deployment_verdict_accuracy, 0.5);
  assert.equal(r.conditional_verdict_accuracy, 1);
  assert.equal(r.sensitivity, null);
});
