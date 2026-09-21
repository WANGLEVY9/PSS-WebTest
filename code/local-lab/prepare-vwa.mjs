import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { probeVwaCapacity } from './vwa-capacity-preflight.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)),
  code = path.resolve(root, "..");
const destination = path.join(code, "artifacts/local-runtime/vwa-runtime.env");
if (!fs.existsSync(destination)) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // The official application expects the fixture's database password. Host port is not published.
  fs.writeFileSync(
    destination,
    `PSS_VWA_CLASSIFIEDS_RESET_TOKEN=${crypto.randomBytes(24).toString("hex")}\nPSS_VWA_DB_PASSWORD=password\n`,
    { mode: 0o600, flag: "wx" },
  );
}
const action = process.argv[2] || "config";
if (!["pull", "up", "ps", "config"].includes(action))
  throw Error("Unsupported deployment action");
if(action==='pull') {
  const capacity=probeVwaCapacity();
  if(!capacity.allowed) {
    console.error(JSON.stringify(capacity));
    throw Error('VWA pull blocked by VM capacity preflight; extending timeout cannot fix insufficient disk');
  }
}
// Image download time is provisioning time, never an agent budget increase.
const timeoutMs = action === 'pull'
  ? Number(process.env.PSS_VWA_PULL_TIMEOUT_MS || 600000) : 600000;
if (!Number.isInteger(timeoutMs) || timeoutMs < 60000 || timeoutMs > 3600000)
  throw Error('Image pull timeout must be 60000..3600000 milliseconds');
const args = [
  "--project-name",
  "pss-vwa-classifieds",
  "--env-file",
  destination,
  "-f",
  path.join(root, "vwa-classifieds.compose.yaml"),
];
if (action === "config") args.push("config", "--quiet");
// Missing images must go through the capacity-checked pull path, not implicit up downloads.
else if (action === "up") args.push("up", "--pull", "never", "-d");
else args.push(action);
const started = new Date().toISOString(),
  job = `vwa-${action}-${Date.now()}`,
  log = path.join(code, "artifacts/local-runtime", `${job}.log`);
const descriptor = fs.openSync(log, "wx", 0o600);
console.log(
  JSON.stringify({ job, pid: process.pid, started, log, timeout_ms: timeoutMs }),
);
const r = spawnSync("docker-compose", args, {
  stdio: ["ignore", descriptor, descriptor],
  timeout: timeoutMs,
  env: { ...process.env, DOCKER_CONTEXT: "colima-webarena-x86" },
});
fs.closeSync(descriptor);
fs.writeFileSync(
  path.join(code, "artifacts/local-runtime", `${job}.json`),
  JSON.stringify(
    {
      job,
      action,
      timeout_ms: timeoutMs,
      pid: process.pid,
      started,
      finished: new Date().toISOString(),
      exit_code: r.status,
      error_code: r.error?.code || null,
      log,
    },
    null,
    2,
  ),
);
if (r.error) console.error(r.error.code || "deployment-process-error");
process.exitCode = r.status ?? 1;
