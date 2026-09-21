// Pure aggregators: never infer counts from rounded manuscript tables.
const mean = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
function binary(v) {
  if (v !== 0 && v !== 1) throw new Error("Expected assessed binary outcome");
  return v;
}
export function wavTemplateMacro(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (r.success === null || r.success === undefined) continue;
    binary(r.success);
    if (r.template_id === undefined) throw new Error("template_id required");
    const a = groups.get(r.template_id) || [];
    a.push(r.success);
    groups.set(r.template_id, a);
  }
  return {
    score: mean([...groups.values()].map(mean)),
    represented_templates: groups.size,
    scored: rows.filter((r) => r.success !== null && r.success !== undefined)
      .length,
    scheduled: rows.length,
  };
}
export function ataMetrics(rows) {
  let TP = 0,
    TN = 0,
    FP = 0,
    FN = 0;
  for (const r of rows) {
    if (!["PASS", "FAIL"].includes(r.expected))
      throw new Error("expected class required");
    if (!["PASS", "FAIL"].includes(r.verdict)) continue;
    if (r.expected === "FAIL") {
      if (r.verdict === "FAIL") TP++;
      else FN++;
    } else if (r.verdict === "PASS") TN++;
    else FP++;
  }
  const n = TP + TN + FP + FN;
  return {
    TP,
    TN,
    FP,
    FN,
    binary_count: n,
    scheduled: rows.length,
    accuracy: n ? (TP + TN) / n : null,
    sensitivity: TP + FN ? TP / (TP + FN) : null,
    specificity: TN + FP ? TN / (TN + FP) : null,
    binary_coverage: rows.length ? n / rows.length : null,
  };
}
export function operationalBounds(opportunities) {
  // Caller supplies all frozen planned opportunities, including unprepared=0 and unresolved=null.
  for (const v of opportunities) if (v !== null) binary(v);
  return {
    n: opportunities.length,
    lower: mean(opportunities.map((v) => v ?? 0)),
    upper: mean(opportunities.map((v) => v ?? 1)),
    unresolved: opportunities.filter((v) => v === null).length,
  };
}
export function retryComplementarity(blocks) {
  // Only the SAME complete four-outcome blocks may contribute to every quantity.
  const complete = blocks.filter((b) =>
    ["c1", "c2", "d1", "d2"].every((k) => b[k] === 0 || b[k] === 1),
  );
  if (!complete.length)
    return { n: 0, mixed: null, cc: null, dd: null, margin: null };
  const mixed = mean(
    complete.map((b) => (Math.max(b.c1, b.d2) + Math.max(b.c2, b.d1)) / 2),
  );
  const cc = mean(complete.map((b) => Math.max(b.c1, b.c2))),
    dd = mean(complete.map((b) => Math.max(b.d1, b.d2)));
  return {
    n: complete.length,
    mixed,
    cc,
    dd,
    margin: mixed - Math.max(cc, dd),
  };
}
