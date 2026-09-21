import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { evaluatorSummary } from "./benchmark-contract.mjs";
import {requestUsage} from './public/resource-accounting.mjs';
import {auditActorRouting} from './model-routing.mjs';
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
  if (b.protocol_sha256 && sha(fs.readFileSync(path.join(dir, "agent-protocol.mjs"))) !== b.protocol_sha256)
    errors.push(`${id}: protocol source digest`);
  if (b.provider_source_sha256 && sha(fs.readFileSync(path.join(dir,'provider.mjs'))) !== b.provider_source_sha256)
    errors.push(`${id}: provider source digest`);
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
    // Legacy fields described context preparation, not verified database reset.
    const prepared = records.filter(r => r.preparation_passed ?? r.reset_passed);
    const preparationDigest = r => r.preparation_digest ?? r.reset_digest;
    if (prepared.some(r => preparationDigest(r) !== preparationDigest(prepared[0])))
      errors.push(`${id}: context preparation mismatch`);
    if (['wav-retrieval-json-v6-diagnostic','wav-retrieval-json-v7-provider-diagnostic'].includes(b.local_protocol) &&
        records.some(r => r.reset_passed !== null || r.reset_digest !== null))
      errors.push(`${id}: unsupported benchmark-reset claim`);
  }
  const routingAudit=auditActorRouting(b);
  errors.push(...routingAudit.errors.map(e=>`${id}: ${e}`));
  const rows = [];
  for (const r of b.records) {
    if (b.protocol_sha256) {
      for (const request of r.requests) {
        if (request.model_requested !== b.model) errors.push(`${id}/${r.record_id}: requested model mismatch`);
        if (!request.input_frame_files?.length || request.input_frame_files.some(file => !r.frames.some(f => f.file === file)))
          errors.push(`${id}/${r.record_id}: missing model input frame reference`);
        if (r.arm === "visual" && request.controls !== undefined)
          errors.push(`${id}/${r.record_id}: visual structural input leak`);
      }
    }
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
      tokens: requestUsage(r.requests).total,
      token_accounting: requestUsage(r.requests),
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
    routing_audit: routingAudit.status,
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
    "Development-only review retrieval tasks from a single site; not representative study evidence.",
    "Protocol versions are separate, not interchangeable repetitions.",
    "Fresh anonymous browser contexts and blocked writes are not a full database reset gate.",
    "Official evaluator errors stay unresolved and may be answer-dependent; never automatically exclude as external infrastructure. Raw score zero is not a valid scored failure.",
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
