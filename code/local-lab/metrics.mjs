export const ARMS = ["visual", "hybrid", "playwright"];
export function summarize(records) {
  return ARMS.map((arm) => {
    const rows = records.filter((r) => r.arm === arm);
    const assessed = rows.filter((r) => typeof r.oracle?.passed === "boolean");
    const terminal = rows.filter((r) => r.finished_at);
    const passed = rows.filter((r) => r.strict_pass === true).length;
    return {
      arm,
      scheduled: rows.length,
      finished: terminal.length,
      assessed: assessed.length,
      passed,
      unresolved: terminal.filter((r) => r.operational_correctness === null)
        .length,
      actions: rows.reduce((n, r) => n + (r.actions?.length || 0), 0),
      tokens: rows.reduce(
        (n, r) =>
          n +
          (r.requests || []).reduce(
            (s, q) => s + (q.usage?.total_tokens || 0),
            0,
          ),
        0,
      ),
      latency_ms: terminal.reduce((n, r) => n + (r.agent_wall_ms || 0), 0),
      cost_usd: null,
      native_benchmark_score: null,
    };
  });
}
export function assess({ completed, oracle, failure_class }) {
  const unresolved =
    ["reset", "environment", "evaluator", "interrupted"].includes(
      failure_class,
    ) || typeof oracle?.passed !== "boolean";
  const passed =
    completed === true && oracle?.passed === true && !failure_class;
  return {
    strict_pass: passed,
    operational_correctness: unresolved ? null : Number(passed),
  };
}
