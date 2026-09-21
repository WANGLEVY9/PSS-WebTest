import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { evaluatorSummary } from "./benchmark-contract.mjs";
const code = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  root = path.join(code, "artifacts/local-runtime");
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex"),
  errors = [],
  batches = [];
for (const id of fs
  .readdirSync(root)
  .filter((x) => /^local-benchmark-[\w-]+$/.test(x))
  .sort()) {
  const dir = path.join(root, id),
    file = path.join(dir, "snapshot.json");
  if (!fs.existsSync(file)) continue;
  const b = JSON.parse(fs.readFileSync(file));
  if (b.status !== "completed") continue;
  if (
    b.data_kind !== "OFFICIAL_BENCHMARK_INTEGRATION" ||
    b.confirmatory_eligible !== false
  )
    errors.push(`${id}: scope`);
  const inputs = JSON.parse(
    fs.readFileSync(path.join(dir, "agent-inputs.json")),
  );
  if (
    sha(fs.readFileSync(path.join(dir, "agent-inputs.json"))) !== b.input_sha256
  )
    errors.push(`${id}: inputs digest`);
  for (const input of inputs) {
    if (
      Object.keys(input).some(
        (k) =>
          ![
            "sites",
            "task_id",
            "intent_template_id",
            "start_urls",
            "intent",
          ].includes(k),
      )
    )
      errors.push(`${id}: unexpected task input field`);
    const records = b.records.filter((r) => r.task_id === input.task_id);
    if (
      records
        .map((r) => r.arm)
        .sort()
        .join(",") !== "hybrid,playwright,visual"
    )
      errors.push(`${id}: arm coverage`);
    if (
      records
        .filter((r) => r.reset_passed)
        .some(
          (r) =>
            r.reset_digest !==
            records.find((x) => x.reset_passed)?.reset_digest,
        )
    )
      errors.push(`${id}: context preparation mismatch`);
  }
  const rows = [];
  for (const r of b.records) {
    for (const frame of r.frames) {
      if (!/^(visual|hybrid|playwright)-\d+-\d{3}\.jpg$/.test(frame.file))
        throw new Error("Invalid frame path");
      if (sha(fs.readFileSync(path.join(dir, frame.file))) !== frame.sha256)
        errors.push(`${id}/${frame.file}: digest`);
    }
    const work = path.join(dir, r.arm, String(r.task_id));
    for (const name of [
      "network.har",
      "agent_response.json",
      "eval_result.json",
    ])
      if (!fs.existsSync(path.join(work, name)))
        errors.push(`${id}/${r.record_id}: missing ${name}`);
    const official = evaluatorSummary(
      JSON.parse(fs.readFileSync(path.join(work, "eval_result.json"))),
    );
    if (
      official.score !== r.oracle?.score ||
      official.status !== r.oracle?.status
    )
      errors.push(`${id}/${r.record_id}: official score mismatch`);
    if (
      r.strict_pass &&
      (!r.protocol_completed || official.passed !== true || r.failure_class)
    )
      errors.push(`${id}/${r.record_id}: invalid strict pass`);
    if (official.status === "error" && r.status !== "unresolved")
      errors.push(
        `${id}/${r.record_id}: evaluator error counted as method failure`,
      );
    rows.push({
      task_id: r.task_id,
      arm: r.arm,
      status: r.status,
      strict_pass: r.strict_pass,
      protocol_completed: r.protocol_completed,
      official_score: official.status === "error" ? null : official.score,
      official_status: official.status,
      evaluator: official,
      frames: r.frames.length,
      actions: r.actions.length,
      requests: r.requests.length,
      tokens: r.requests.reduce((n, q) => n + (q.usage?.total_tokens || 0), 0),
      agent_wall_ms: r.agent_wall_ms ?? null,
      failure_class: r.failure_class || null,
      exception: r.error || null,
      response_sha256: sha(
        fs.readFileSync(path.join(work, "agent_response.json")),
      ),
      har_sha256: sha(fs.readFileSync(path.join(work, "network.har"))),
    });
  }
  batches.push({
    id,
    source_commit: b.source_commit,
    task_ids: b.task_ids,
    model: b.model,
    protocol: b.local_protocol,
    input_sha256: b.input_sha256,
    script_sha256: b.script_sha256,
    runner_sha256: b.runner_sha256,
    snapshot_sha256: sha(fs.readFileSync(file)),
    confirmatory_eligible: false,
    records: rows,
  });
}
const report = {
  scope: "official-benchmark-integration-not-confirmatory",
  generated_at: new Date().toISOString(),
  errors,
  batches,
  caveats: [
    "Two tasks from one template and one site; not representative study evidence.",
    "Protocol versions are separate, not interchangeable repetitions.",
    "Fresh anonymous browser contexts and blocked writes are not a full database reset gate.",
    "Official evaluator errors stay unresolved; diagnostic raw score zero is not a valid scored failure.",
    "Script is AI-assisted public-UI adaptation, not a blinded human-authored baseline.",
    "Task-specific matches and original reference answers were not edited to obtain success.",
  ],
};
fs.writeFileSync(
  path.join(root, "benchmark-validation.json"),
  JSON.stringify(report, null, 2),
);
if (process.argv.includes("--export-public")) {
  const dest = path.resolve(code, "../results/local-runtime");
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(
    path.join(dest, "2026-09-21-official-benchmark-summary.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  JSON.stringify({
    batches: batches.length,
    records: batches.reduce((n, b) => n + b.records.length, 0),
    errors,
  }),
);
if (errors.length) process.exitCode = 1;
