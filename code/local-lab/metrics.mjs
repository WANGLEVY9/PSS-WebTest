import {requestUsage,reportedTotal} from './public/resource-accounting.mjs';
export const ARMS = ["visual", "hybrid", "playwright"];
export function summarize(records) {
  return ARMS.map((arm) => {
    const rows = records.filter((r) => r.arm === arm);
    const assessed = rows.filter((r) => typeof r.oracle?.passed === "boolean");
    const terminal = rows.filter((r) => r.finished_at);
    const passed = rows.filter((r) => r.strict_pass === true).length;
    const usage=requestUsage(rows.flatMap(r=>r.requests||[]));
    const latency=reportedTotal(terminal.map(r=>r.agent_wall_ms));
    return {
      arm,
      scheduled: rows.length,
      finished: terminal.length,
      assessed: assessed.length,
      passed,
      unresolved: terminal.filter((r) => r.operational_correctness === null)
        .length,
      actions: rows.reduce((n, r) => n + (r.actions?.length || 0), 0),
      tokens: usage.total,
      token_accounting: usage,
      latency_ms: latency.total,
      latency_accounting: latency,
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
