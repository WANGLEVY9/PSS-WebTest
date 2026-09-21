import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const code = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  store = path.join(code, "artifacts/local-runtime");
const read = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};
const batches = fs
  .readdirSync(store)
  .filter((n) => /^local-benchmark-/.test(n))
  .map((n) => read(path.join(store, n, "snapshot.json")))
  .filter(Boolean);
const records = batches.flatMap((b) => b.records),
  last = batches
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .at(-1);
const ata = read(path.join(store, "ata-preparation/summary.json"));
let images = [];
try {
  images = JSON.parse(
    execFileSync(
      "docker",
      [
        "--context",
        "colima-webarena-x86",
        "image",
        "inspect",
        "mysql:8.1",
        "jykoh/classifieds:latest",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000 },
    ),
  ).map((i) => ({ id: i.Id, digests: i.RepoDigests }));
} catch {}
let classifieds;
try {
  const r = await fetch("http://127.0.0.1:9980/", {
    signal: AbortSignal.timeout(5000),
    redirect: "manual",
  });
  classifieds = { http_status: r.status };
} catch {
  classifieds = { http_status: null };
}
const progress = {
  observed_at: new Date().toISOString(),
  confirmatory_authorized: false,
  benchmarks: [
    {
      id: "webarena-verified",
      name: "WebArena-Verified",
      state: "Integration only",
      detail: `${new Set(batches.flatMap((b) => b.task_ids)).size} unique development tasks / ${records.filter((r) => r.finished_at).length} completed executions. Protocol strata remain separate.`,
      latest_batch: last?.id,
    },
    {
      id: "visualwebarena",
      name: "VisualWebArena",
      state: "Environment preparation",
      detail: `Official Classifieds archive verified. ${images.length === 2 ? "Container images downloaded." : read(path.join(store, "vwa-deployment.json"))?.pull_error === "ETIMEDOUT" ? "Image pull reached its 10-minute limit; service not started." : "Container image download pending."} Reset, fixture and original-evaluator gates remain open.`,
      images,
      classifieds,
    },
    {
      id: "ata",
      name: "ATA Benchmark",
      state: "Artifact audit / blocked",
      detail: `${ata?.published_tasks ?? 0} parsed candidates; v1 inventory has 112. Label separation implemented; population amendment and live fixture-label equivalence unresolved.`,
      audit_warnings: ata?.warnings || [],
      executions: 0,
    },
  ],
  human_review:
    "Included, excluded and Traditional-adaptation ledgers are not yet completed; AI audit does not replace independent reviewers.",
  next: [
    "Diagnose output-contract failures before more API batches",
    "Finish isolated VWA Classifieds deployment and three reset cycles",
    "Resolve ATA inventory and step-index anomalies",
    "Freeze screened disjoint populations and blinded adaptation",
    "Run stratified pilot and power simulation before formal authorization",
  ],
};
fs.writeFileSync(
  path.join(store, "benchmark-expansion.json"),
  JSON.stringify(progress, null, 2),
);
if (process.argv.includes("--export-public"))
  fs.writeFileSync(
    path.resolve(
      code,
      "../results/local-runtime/2026-09-21-benchmark-expansion.json",
    ),
    JSON.stringify(progress, null, 2),
  );
console.log(JSON.stringify(progress, null, 2));
