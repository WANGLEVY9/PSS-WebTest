import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const code = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  root = path.join(code, "artifacts/local-runtime");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const batches = [];
const errors = [];
const warnings = [];
for (const id of fs
  .readdirSync(root)
  .filter((n) => /^local-[\w-]+$/.test(n))
  .sort()) {
  const file = path.join(root, id, "snapshot.json");
  if (!fs.existsSync(file)) continue;
  const b = JSON.parse(fs.readFileSync(file));
  // Official cases have their own task-level validator and are never pooled here.
  if (b.data_kind === "OFFICIAL_BENCHMARK_INTEGRATION") continue;
  if (b.status !== "completed") {
    warnings.push(`${id}: incomplete batch`);
    continue;
  }
  if (b.data_kind !== "LIVE_ENGINEERING" || b.confirmatory_eligible !== false)
    errors.push(`${id}: evidence scope violated`);
  if (
    [...b.records.map((r) => r.arm)].sort().join(",") !==
    "hybrid,playwright,visual"
  )
    errors.push(`${id}: missing or duplicate arms`);
  const reset = new Set(
    b.records.filter((r) => r.reset_passed).map((r) => r.reset_digest),
  );
  if (reset.size !== 1) errors.push(`${id}: non-matched reset`);
  for (const r of b.records) {
    for (const f of r.frames) {
      if (!/^(visual|hybrid|playwright)-\d{3}\.jpg$/.test(f.file))
        throw new Error("invalid frame path");
      if (hash(fs.readFileSync(path.join(root, id, f.file))) !== f.sha256)
        errors.push(`${id}/${f.file}: digest mismatch`);
    }
    if (
      r.strict_pass &&
      (!r.protocol_completed || !r.oracle?.passed || r.failure_class)
    )
      errors.push(`${id}/${r.arm}: false pass`);
    if (r.agent_wall_ms === undefined && r.requests.length)
      warnings.push(
        `${id}/${r.arm}: legacy diagnostic lacks agent duration; do not impute zero`,
      );
  }
  batches.push({
    id,
    model: b.model,
    local_protocol: b.local_protocol || "legacy-native-normalized-tool",
    snapshot_sha256: hash(fs.readFileSync(file)),
    data_kind: b.data_kind,
    confirmatory_eligible: false,
    records: b.records.map((r) => ({
      arm: r.arm,
      status: r.status,
      strict_pass: r.strict_pass,
      protocol_completed: r.protocol_completed,
      oracle_passed: r.oracle?.passed ?? null,
      reset_passed: r.reset_passed,
      frames: r.frames.length,
      actions: r.actions.length,
      requests: r.requests.length,
      http_statuses: [...new Set(r.requests.map((q) => q.http_status))],
      tokens: r.requests.reduce((n, q) => n + (q.usage?.total_tokens || 0), 0),
      agent_wall_ms: r.agent_wall_ms ?? null,
      failure_class:
        r.failure_class ??
        (r.oracle?.passed === false && r.protocol_completed
          ? "verdict-postcondition-disagreement"
          : null),
    })),
  });
}
const report = {
  generated_at: new Date().toISOString(),
  scope: "local-engineering-not-confirmatory",
  errors,
  warnings,
  batches,
};
fs.writeFileSync(
  path.join(root, "validation.json"),
  JSON.stringify(report, null, 2),
);
if (process.argv.includes("--export-public")) {
  const dest = path.resolve(code, "../results/local-runtime");
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(
    path.join(dest, "2026-09-21-summary.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  JSON.stringify(
    {
      batches: batches.length,
      records: batches.reduce((n, b) => n + b.records.length, 0),
      errors,
      warnings,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
