// Label-based ATA evaluation. Predictions are NEVER the reference truth.
export function scoreAta(rows) {
  const c = {
    scheduled: rows.length,
    TP: 0,
    TN: 0,
    FP: 0,
    FN: 0,
    AFA: 0,
    AFB: 0,
    AFC: 0,
    missing: 0,
    invalid_failure_step: 0,
  };
  for (const r of rows) {
    if (!["P", "F"].includes(r.gold)) throw Error("Invalid gold label");
    if (!["PASS", "FAIL"].includes(r.predicted)) {
      c.missing++;
      continue;
    }
    if (r.gold === "P") {
      c[r.predicted === "PASS" ? "TN" : "FP"]++;
      continue;
    }
    if (r.predicted === "PASS") {
      c.FN++;
      continue;
    }
    c.TP++;
    if (
      !Number.isInteger(r.step) ||
      !Number.isInteger(r.expected_step) ||
      r.step < 1 ||
      r.expected_step < 1
    ) {
      c.invalid_failure_step++;
      continue;
    }
    c[
      r.step < r.expected_step
        ? "AFB"
        : r.step > r.expected_step
          ? "AFA"
          : "AFC"
    ]++;
  }
  const divide = (a, b) => (b ? a / b : null),
    valid = c.TP + c.TN + c.FP + c.FN;
  return {
    ...c,
    valid_verdicts: valid,
    verdict_coverage: divide(valid, c.scheduled),
    deployment_verdict_accuracy: divide(c.TP + c.TN, c.scheduled),
    conditional_verdict_accuracy: divide(c.TP + c.TN, valid),
    sensitivity: divide(c.TP, c.TP + c.FN),
    specificity: divide(c.TN, c.TN + c.FP),
    strict_step_accuracy: divide(c.AFC + c.TN, c.scheduled),
    AER: divide(c.AFB, c.TP),
    HER: divide(c.AFA, c.TP),
    SMER: divide(c.AFB + c.AFA, c.TP),
  };
}
