import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {loadRuntimeEnv} from './runtime-env.mjs';
import {resolveProvider, publicProvider} from './provider.mjs';
import { alive } from "./lock.mjs";
import { currentExecutionGate } from './execution-gate.mjs';
import { resetProgress } from './reset-evidence.mjs';
import { summarize } from "./metrics.mjs";
import { PROTOCOL } from "./agent-protocol.mjs";
const root = path.dirname(fileURLToPath(import.meta.url)),
  code = path.resolve(root, "..");
const runtimeEnv=loadRuntimeEnv();
function providerStatus() {
  try {
    const config=resolveProvider(runtimeEnv,{requireKey:false});
    return {...publicProvider(config),configured:Boolean(config.apiKey),live_verified:false};
  } catch(e) {return {configured:false,error:e.message,live_verified:false};}
}
const store = path.join(code, "artifacts", "local-runtime");
const expectedResetImage=JSON.parse(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json')))
  .mandatory_core.find(b=>b.id==='webarena-verified').environment.candidate_image.reference;
fs.mkdirSync(store, { recursive: true });
const port = Number(runtimeEnv.PSS_LOCAL_PORT || 4173),
  token = crypto.randomBytes(24).toString("hex");
let child = null,
  active = null;
function read(id) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(store, id, "snapshot.json"), "utf8"),
    );
  } catch {
    return null;
  }
}
function batches() {
  return fs
    .readdirSync(store)
    .filter((n) => /^local-[\w-]+$/.test(n))
    .sort()
    .reverse()
    .map(read)
    .filter(Boolean);
}
const json = (res, data, status = 200) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
};
function interrupt(b) {
  b.status = "interrupted";
  b.interrupted_at = new Date().toISOString();
  for (const r of b.records.filter((r) => !r.finished_at)) {
    r.status = "unresolved";
    r.failure_class = "interrupted";
    r.operational_correctness = null;
    r.strict_pass = false;
    r.finished_at = b.interrupted_at;
  }
  b.metrics = summarize(b.records);
  fs.appendFileSync(
    path.join(store, b.id, "events.jsonl"),
    JSON.stringify({ type: "interrupted", at: b.interrupted_at }) + "\n",
  );
  fs.writeFileSync(
    path.join(store, b.id, "snapshot.json"),
    JSON.stringify(b, null, 2),
  );
}
const server = http.createServer((req, res) => {
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host))
      return json(res, { error: "invalid host" }, 403);
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "GET" && url.pathname === "/api/state") {
      let benchmark = null;
      try {
        benchmark = JSON.parse(
          fs.readFileSync(path.join(store, "benchmark-readiness.json"), "utf8"),
        );
      } catch {}
      return json(res, {
        token,
        active,
        model: providerStatus().model || null,
        next_protocol: PROTOCOL,
        diagnostic_start_enabled: runtimeEnv.PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN === "1",
        execution_gate: currentExecutionGate(),
        reset_preflight: resetProgress(store,expectedResetImage),
        provider: providerStatus().provider || null,
        provider_configuration: providerStatus(),
        configured: providerStatus().configured,
        sponsor_readiness: fs.existsSync(path.join(store,'sponsor-readiness.json'))
          ? JSON.parse(fs.readFileSync(path.join(store,'sponsor-readiness.json'),'utf8')) : null,
        benchmark,
        conformance: fs.existsSync(path.join(store,'benchmark-conformance.json'))
          ? JSON.parse(fs.readFileSync(path.join(store,'benchmark-conformance.json'),'utf8')) : null,
        selection: JSON.parse(
          fs.readFileSync(path.join(root, "benchmark-selection.json"), "utf8"),
        ),
        expansion: fs.existsSync(path.join(store, "benchmark-expansion.json"))
          ? JSON.parse(
              fs.readFileSync(
                path.join(store, "benchmark-expansion.json"),
                "utf8",
              ),
            )
          : null,
        batches: batches(),
      });
    }
    if (req.method === "POST" && url.pathname === "/api/start") {
      if (
        req.headers["x-local-token"] !== token ||
        req.headers.origin !== `http://${req.headers.host}`
      )
        return json(res, { error: "same-origin token required" }, 403);
      if (
        child ||
        batches().some((b) => b.status === "running" && alive(b.runner_pid))
      )
        return json(
          res,
          { error: "a run is already active; resets must remain isolated" },
          409,
        );
      try { resolveProvider(runtimeEnv); }
      catch(e) { return json(res, { error: e.message }, 400); }
      if (runtimeEnv.PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN !== "1")
        return json(res, { error: "Batch collection paused. The revised diagnostic protocol requires explicit enablement after review." }, 409);
      const admission = currentExecutionGate();
      if (!admission.allowed)
        return json(res, { error: 'Benchmark admission gate blocked', execution_gate: admission }, 409);
      active = `local-benchmark-${Date.now()}`;
      const id = active;
      fs.mkdirSync(path.join(store, id), { recursive: true });
      const log = fs.openSync(path.join(store, id, "process.log"), "a", 0o600);
      child = spawn(
        process.execPath,
        [path.join(root, "benchmark-runner.mjs"), id],
        {
          cwd: code,
          env: runtimeEnv,
          stdio: ["ignore", log, log],
        },
      );
      fs.closeSync(log);
      const finish = (exitCode) => {
        const b = read(id);
        if (b && b.status === "running") {
          b.process_exit_code = exitCode;
          interrupt(b);
        }
        child = null;
        active = null;
      };
      child.once("error", () => finish(-1));
      child.once("exit", finish);
      return json(res, { id }, 202);
    }
    if (req.method !== "GET")
      return json(res, { error: "method not allowed" }, 405);
    const artifact = url.pathname.match(
      /^\/artifacts\/(local-[\w-]+)\/((?:visual|hybrid|playwright)(?:-\d+)?-\d{3}\.jpg|(?:visual|hybrid|playwright)(?:-\d+)?-trace\.zip|snapshot\.json|events\.jsonl)$/,
    );
    let target;
    if (artifact) target = path.join(store, artifact[1], artifact[2]);
    else if (
      ["/", "/index.html", "/app.js", "/style.css", "/resource-accounting.mjs"].includes(url.pathname)
    )
      target = path.join(
        root,
        "public",
        url.pathname === "/" ? "index.html" : url.pathname.slice(1),
      );
    else return json(res, { error: "not found" }, 404);
    if (!fs.existsSync(target)) return json(res, { error: "not found" }, 404);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".mjs": "text/javascript",
      ".css": "text/css",
      ".jpg": "image/jpeg",
      ".json": "application/json",
      ".jsonl": "application/x-ndjson",
      ".zip": "application/zip",
    };
    res.writeHead(200, {
      "content-type": types[path.extname(target)] || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    fs.createReadStream(target).pipe(res);
  } catch {
    json(res, { error: "local service error" }, 500);
  }
});
server.listen(port, "127.0.0.1", () => {
  for (const b of batches().filter(
    (b) => b.status === "running" && !alive(b.runner_pid),
  ))
    interrupt(b);
  console.log(`PSS local workbench http://127.0.0.1:${port}`);
});
