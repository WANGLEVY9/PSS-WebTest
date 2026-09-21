import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { acquireLock } from "./lock.mjs";
import { summarize } from "./metrics.mjs";
import { runReviewScript } from "./benchmark-script.mjs";
import { retrievalResponse, evaluatorSummary } from "./benchmark-contract.mjs";
import { PROTOCOL, OBSERVATION_POLICY, MAX_CONSECUTIVE_PROTOCOL_ERRORS,
  resolveModel, observePixels, parseDecision, modelMessages, confirmAnswer, diagnosticTasks, responseFormat } from "./agent-protocol.mjs";

const root = path.dirname(fileURLToPath(import.meta.url)),
  code = path.resolve(root, "..");
dotenv.config({ path: path.join(code, ".env"), quiet: true });
const modelConfig = resolveModel(process.env);
const model = modelConfig.model;
if (process.env.CUA_PROVIDER !== "aliyun" || !process.env.CUA_API_KEY)
  throw new Error("Qwen credentials are not configured");
if (process.env.PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN !== "1")
  throw new Error("Diagnostic protocol requires explicit PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN=1; no automatic batches");
const store = path.join(code, "artifacts/local-runtime"),
  id = process.argv[2] || `local-benchmark-${Date.now()}`;
if (!/^local-[\w-]+$/.test(id)) throw new Error("Invalid run ID");
const release = acquireLock(store);
process.once("exit", release);
const dir = path.join(store, id);
if (fs.existsSync(path.join(dir, "snapshot.json")))
  throw new Error("Run already exists; refusing to overwrite evidence");
fs.mkdirSync(dir, { recursive: true });
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex"),
  now = () => new Date().toISOString();
const selection = JSON.parse(
  fs.readFileSync(path.join(root, "benchmark-selection.json")),
);
const selectedTaskIds = diagnosticTasks(selection.task_ids, process.env.PSS_LOCAL_TASK_IDS);
const sourceCommit = execFileSync(
  "git",
  [
    "-C",
    path.join(code, "artifacts/benchmark-snapshots/webarena-verified"),
    "rev-parse",
    "HEAD",
  ],
  { encoding: "utf8" },
).trim();
if (sourceCommit !== selection.source_commit)
  throw new Error("Official benchmark checkout differs from pinned selection");
// Preserve executable source for later replay; no secrets or evaluator gold are copied.
for (const file of [
  "benchmark-runner.mjs",
  "benchmark-script.mjs",
  "benchmark-contract.mjs",
  "agent-protocol.mjs",
  "benchmark-selection.json",
  "benchmark-config.json",
])
  fs.copyFileSync(path.join(root, file), path.join(dir, file));
const cli = path.join(code, ".venv-benchmark/bin/webarena-verified");
const config = path.join(root, "benchmark-config.json");
// Official export is the only source of model-facing task inputs. No eval fields are loaded here.
execFileSync(
  cli,
  [
    "agent-input-get",
    "--config",
    config,
    "--task-ids",
    selectedTaskIds.join(","),
    "--output",
    path.join(dir, "agent-inputs.json"),
  ],
  { stdio: "pipe", timeout: 60000 },
);
const tasks = JSON.parse(fs.readFileSync(path.join(dir, "agent-inputs.json")));
const batch = {
  schema_version: "local-runtime-v1",
  id,
  runner_pid: process.pid,
  started_at: now(),
  status: "running",
  data_kind: "OFFICIAL_BENCHMARK_INTEGRATION",
  confirmatory_eligible: false,
  benchmark: "webarena-verified",
  source_commit: selection.source_commit,
  task_ids: selectedTaskIds,
  development_subset: process.env.PSS_LOCAL_TASK_IDS || null,
  tasks,
  model,
  model_configuration_source: modelConfig.source,
  provider: "aliyun",
  framework: "PSS benchmark adapter",
  local_protocol: PROTOCOL,
  intent: "Official review retrieval tasks",
  protocol_change:
    "v5 adds model-capability-gated strict JSON Schema to v4 remediation. No guessed missing actions or coerced coordinates. Not a single-factor model comparison against v3.",
  observation_policy: OBSERVATION_POLICY,
  protocol_sha256: sha(fs.readFileSync(path.join(root, "agent-protocol.mjs"))),
  information_boundary: { visual: "screenshots and own action feedback only", hybrid: "screenshots plus visible control list; NOT full DOM or AX tree" },
  traditional_policy: "role + CSS locators and public rating tooltip attributes; not accessibility-only",
  selection_sha256: sha(
    fs.readFileSync(path.join(root, "benchmark-selection.json")),
  ),
  input_sha256: sha(fs.readFileSync(path.join(dir, "agent-inputs.json"))),
  script_sha256: sha(fs.readFileSync(path.join(root, "benchmark-script.mjs"))),
  runner_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  script_authoring:
    "AI-assisted, public UI, frozen before official evaluation and agent execution; not a human-authored baseline claim",
  budget: {
    max_decisions: 24,
    agent_timeout_ms: 240000,
    request_timeout_ms: 45000,
    max_consecutive_protocol_errors: MAX_CONSECUTIVE_PROTOCOL_ERRORS,
    retry_accounting: "All attempts consume decision, wall-time and token budgets; no HTTP retries",
  },
  reset_contract:
    "read-only retrieval; isolated fresh browser contexts; no full database-reset claim",
  records: tasks.flatMap((t) =>
    ["visual", "hybrid", "playwright"].map((arm) => ({
      arm,
      task_id: t.task_id,
      record_id: `${arm}-${t.task_id}`,
      status: "queued",
      frames: [],
      actions: [],
      requests: [],
      oracle: null,
      strict_pass: false,
      operational_correctness: null,
    })),
  ),
};
function save() {
  batch.metrics = summarize(batch.records);
  fs.writeFileSync(
    path.join(dir, "snapshot.tmp"),
    JSON.stringify(batch, null, 2),
  );
  fs.renameSync(
    path.join(dir, "snapshot.tmp"),
    path.join(dir, "snapshot.json"),
  );
}
function emit(type, details = {}) {
  fs.appendFileSync(
    path.join(dir, "events.jsonl"),
    JSON.stringify({ at: now(), type, ...details }) + "\n",
  );
  save();
}
const clean = (e) =>
  String(e?.message || e)
    .replaceAll(process.env.CUA_API_KEY, "[REDACTED]")
    .slice(0, 600);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
emit("batch-start");
let health;
try {
  health = await (
    await fetch("http://localhost:7771/status", {
      signal: AbortSignal.timeout(20000),
    })
  ).json();
} catch (e) {
  batch.environment_error = clean(e);
}
batch.environment_ready = health?.success === true;
batch.services = health?.details?.value?.services || null;
if (!batch.environment_ready) {
  for (const r of batch.records) {
    r.status = "unresolved";
    r.failure_class = "environment";
    r.finished_at = now();
  }
  batch.status = "completed";
  batch.finished_at = now();
  emit("environment-blocked");
  process.exitCode = 2;
} else {
  for (const task of tasks) {
    const order = ["visual", "hybrid", "playwright"].sort((a, b) =>
      sha(id + task.task_id + a).localeCompare(sha(id + task.task_id + b)),
    );
    for (const arm of order) {
      const r = batch.records.find(
          (r) => r.arm === arm && r.task_id === task.task_id,
        ),
        work = path.join(dir, arm, String(task.task_id));
      fs.mkdirSync(work, { recursive: true });
      r.started_at = now();
      r.status = "preparing";
      emit("case-start", { record_id: r.record_id });
      let browser,
        context,
        page,
        capture,
        agentStart,
        answer = null,
        completed = false;
      try {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          recordHar: {
            path: path.join(work, "network.har"),
            mode: "full",
            content: "embed",
          },
        });
        await context.tracing.start({ screenshots: true, snapshots: true });
        page = await context.newPage();
        page.setDefaultTimeout(20000);
        // Prevent accidental writes during the selected read-only retrieval tasks.
        await page.route("**/*", (route) =>
          ["GET", "HEAD", "OPTIONS"].includes(route.request().method())
            ? route.continue()
            : route.abort("blockedbyclient"),
        );
        await page.goto(task.start_urls[0], {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        r.reset_passed = true;
        r.reset_digest = sha(
          JSON.stringify({
            start: task.start_urls[0],
            source_commit: selection.source_commit,
            context: "fresh-anonymous",
            mutation: "blocked",
          }),
        );
        r.status = "running";
        r.agent_started_at = now();
        agentStart = Date.now();
        emit("ready", { record_id: r.record_id });
        capture = async (phase, step) => {
          const image = await page.screenshot({
              type: "jpeg",
              quality: 85,
              animations: "disabled",
            }),
            file = `${r.record_id}-${String(r.frames.length).padStart(3, "0")}.jpg`;
          fs.writeFileSync(path.join(dir, file), image);
          r.frames.push({
            file,
            sha256: sha(image),
            phase,
            step,
            at: now(),
            url: page.url(),
          });
          emit("frame", { record_id: r.record_id, step });
          return `data:image/jpeg;base64,${image.toString("base64")}`;
        };
        await capture("initial", 0);
        if (arm === "playwright") {
          answer = await runReviewScript(page, task, async (action) => {
            r.actions.push({ at: now(), ...action });
            await capture("after-action", r.actions.length);
          });
          completed = true;
        } else {
          const history = [], previousImages = [], feedback = [];
          let protocolErrors = 0, candidateAnswer = null;
          for (let step = 0; step < batch.budget.max_decisions; step++) {
            if (Date.now() - agentStart >= 240000)
              throw new Error("Agent wall-time budget exceeded");
            const observation = await observePixels({
              capture: () => capture("observation-sample", step), sleep,
              deadline: agentStart + batch.budget.agent_timeout_ms,
            });
            let image = observation.image;
            r.observations ||= [];
            r.observations.push({ step, samples: observation.samples, elapsed_ms: observation.elapsed_ms,
              reason: observation.reason, semantic_ready: null });
            let controls = [];
            if (arm === "hybrid")
              controls = await page.evaluate(() =>
                [
                  ...document.querySelectorAll(
                    "a,button,input:not([type=hidden]),textarea,[role=tab],[role=button]",
                  ),
                ]
                  .flatMap((e) => {
                    const b = e.getBoundingClientRect(),
                      s = getComputedStyle(e),
                      x = b.x + b.width / 2,
                      y = b.y + b.height / 2;
                    if (
                      !b.width ||
                      !b.height ||
                      x < 0 ||
                      x >= innerWidth ||
                      y < 0 ||
                      y >= innerHeight ||
                      s.visibility !== "visible" ||
                      s.display === "none"
                    )
                      return [];
                    const hit = document.elementFromPoint(x, y);
                    if (!hit || !e.contains(hit)) return [];
                    return [
                      {
                        role:
                          e.getAttribute("role") ||
                          (e.tagName === "A"
                            ? "link"
                            : /INPUT|TEXTAREA/.test(e.tagName)
                              ? "textbox"
                              : "button"),
                        name: (
                          e.getAttribute("aria-label") ||
                          e.innerText ||
                          e.getAttribute("placeholder") ||
                          ""
                        )
                          .trim()
                          .slice(0, 200),
                        x: Math.round(x),
                        y: Math.round(y),
                      },
                    ];
                  })
                  .slice(0, 100)
                  .map((e, i) => ({ ...e, target_id: `c${i}` })),
              );
            if (arm === "hybrid") {
              // Bracket DOM extraction with screenshots. Never use DOM as readiness input.
              const checkedImage = await capture("structure-bracket", step);
              if (checkedImage !== image) {
                feedback.push("The screenshot changed during observation; no action was executed. Observe again.");
                r.observations.at(-1).structure_synchronized = false;
                emit("observation-retry", { record_id: r.record_id, step });
                continue;
              }
              r.observations.at(-1).structure_synchronized = true;
              controls = controls.map(c => ({ ...c, target_id: `o${step}-${c.target_id}` }));
            }
            const instructions = `You execute an official WebArena-Verified task. Task: ${task.intent}\nRetrieve exactly the items specified in the task (reviewer names or review titles). Read all relevant reviews and pages before answering. Use only the provided screenshots${arm === "hybrid" ? " and current visible controls" : ""}. No external knowledge or guessed names.\nReturn exactly one JSON object. Actions: {"action":"click","x":500,"y":500}${arm === "hybrid" ? ` or {"action":"click","target_id":"o${step}-c2"}` : ""}, {"action":"scroll","delta_y":500}, {"action":"keypress","key":"Enter"}, {"action":"type","text":"text"}, {"action":"wait"}. Use integer scroll distances. To finish: {"action":"done","answer":["retrieved text"]}. Click coordinates are normalized to 0..1000 on EACH axis (image 1280x720). Preserve the requested text exactly as displayed; return an empty answer array only if no matching items were found after examination. A quiet screenshot does not prove loading is complete; wait when needed. If you need to keep reading, scroll rather than claiming done. Your recent accepted actions and visual notes: ${JSON.stringify(history.slice(-12))}. Historical target IDs cannot be reused. Include a short "note" (at most 2000 characters) of observed matching items and remaining work to preserve cross-screen evidence; never invent unseen facts. Recent protocol feedback: ${JSON.stringify(feedback.slice(-3))}.${candidateAnswer !== null ? `\nYou proposed answer ${JSON.stringify(candidateAnswer)}. Check the new current screenshot before repeating done to confirm, or continue reading/correct the answer.` : ""}${arm === "hybrid" ? "\nObservation-local controls: " + JSON.stringify(controls) : ""}`;
            const body = {
              model,
              temperature: 0,
              enable_thinking: false,
              max_tokens: 1024,
              response_format: responseFormat(model, controls, arm),
              messages: modelMessages(instructions, previousImages, image),
            };
            const request = {
              step,
              status: "pending",
              at: now(),
              input_digest: sha(JSON.stringify(body)),
              prompt_text: instructions,
              model_requested: model,
              response_format: body.response_format,
              input_frame_files: [...previousImages.slice(-2).map(f => f.file), r.frames.at(-1).file],
              controls: arm === "hybrid" ? controls : undefined,
            };
            previousImages.push({ image, step, file: r.frames.at(-1).file });
            if (previousImages.length > 2) previousImages.shift();
            r.requests.push(request);
            emit("provider-start", { record_id: r.record_id, step });
            let decision;
            const begin = Date.now();
            try {
              const response = await fetch(
                process.env.CUA_BASE_URL.replace(/\/$/, "") +
                  "/chat/completions",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${process.env.CUA_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(body),
                  signal: AbortSignal.timeout(
                    Math.min(
                      45000,
                      Math.max(1, 240000 - (Date.now() - agentStart)),
                    ),
                  ),
                },
              );
              const payload = await response.json();
              request.http_status = response.status;
              request.model_returned = payload.model || null;
              request.provider_request_id = payload.id || null;
              request.usage = payload.usage || null;
              request.finish_reason = payload.choices?.[0]?.finish_reason;
              request.output = payload.choices?.[0]?.message?.content || null;
              if (!response.ok)
                throw new Error(`Provider HTTP ${response.status}`);
              request.status = "received";
            } catch (e) {
              request.status = "error";
              request.error = clean(e);
              r.failure_class = /timeout|abort/i.test(request.error) ? "provider-timeout" : "provider-http-or-response";
              throw e;
            } finally {
              request.latency_ms = Date.now() - begin;
              emit("provider-end", { record_id: r.record_id, step });
            }
            try {
              decision = parseDecision(request.output, { controls, arm });
              protocolErrors = 0;
            } catch (e) {
              request.status = "contract-error";
              request.error = clean(e);
              protocolErrors++;
              feedback.push(`${clean(e)}. No action was executed. Retry with the current observation.`);
              r.protocol_errors ||= [];
              r.protocol_errors.push({ step, error: clean(e), consecutive: protocolErrors });
              candidateAnswer = null;
              emit("action-contract-error", { record_id: r.record_id, step });
              if (protocolErrors > MAX_CONSECUTIVE_PROTOCOL_ERRORS)
                throw new Error("Malformed action JSON or target; recovery budget exhausted");
              continue;
            }
            if (decision.action === "done") {
              if (
                !Array.isArray(decision.answer) ||
                decision.answer.some((s) => typeof s !== "string")
              )
                throw new Error("Malformed benchmark answer");
              if (!confirmAnswer(candidateAnswer, decision.answer)) {
                candidateAnswer = decision.answer;
                emit("answer-proposed", { record_id: r.record_id, step });
                continue;
              }
              answer = decision.answer;
              completed = true;
              break;
            }
            candidateAnswer = null;
            if (decision.action === "click") {
              let x, y;
              if (arm === "hybrid" && decision.target_id) {
                const t = controls.find(
                  (c) => c.target_id === decision.target_id,
                );
                if (!t) throw new Error("Unknown observation-local target");
                ({ x, y } = t);
              } else {
                if (
                  !Number.isInteger(decision.x) ||
                  !Number.isInteger(decision.y) ||
                  decision.x < 0 ||
                  decision.x > 1000 ||
                  decision.y < 0 ||
                  decision.y > 1000
                )
                  throw new Error("Malformed normalized coordinates");
                x = Math.min(1279, Math.round(decision.x * 1.28));
                y = Math.min(719, Math.round(decision.y * 0.72));
              }
              await page.mouse.click(x, y);
            } else if (decision.action === "scroll") {
              if (
                !Number.isFinite(decision.delta_y) ||
                Math.abs(decision.delta_y) > 1440
              )
                throw new Error("Malformed scroll");
              await page.mouse.wheel(0, decision.delta_y);
            } else if (decision.action === "keypress") {
              if (
                ![
                  "Enter",
                  "Tab",
                  "Escape",
                  "ArrowDown",
                  "ArrowUp",
                  "PageDown",
                  "PageUp",
                ].includes(decision.key)
              )
                throw new Error("Unsupported key");
              await page.keyboard.press(decision.key);
            } else if (decision.action === "type") {
              if (
                typeof decision.text !== "string" ||
                decision.text.length > 200
              )
                throw new Error("Malformed text");
              await page.keyboard.type(decision.text);
            } else if (decision.action === "wait") await sleep(1500);
            else throw new Error("Unsupported model action");
            const action = {
              ...decision,
              type: decision.action,
              step,
              at: now(),
            };
            history.push(decision);
            r.actions.push(action);
            emit("action", { record_id: r.record_id, step });
          }
          if (!completed) r.failure_class = "step-budget";
        }
        if (Date.now() - agentStart > 240000) {
          completed = false;
          r.failure_class = "time-budget";
        }
      } catch (e) {
        r.error = clean(e);
        r.failure_class ||= !agentStart
          ? "environment"
          : /budget/i.test(r.error)
            ? "time-budget"
            : /timeout|abort/i.test(r.error)
              ? "provider-or-action-timeout"
              : /JSON|Malformed|Unsupported|Unknown observation/i.test(r.error)
                ? "model-output-contract"
                : "execution";
      } finally {
        if (agentStart) r.agent_wall_ms = Date.now() - agentStart;
        if (capture)
          try {
            await capture("final", r.actions.length);
          } catch (e) {
            r.capture_error = clean(e);
          }
        if (context) {
          try {
            await context.tracing.stop({
              path: path.join(dir, `${r.record_id}-trace.zip`),
            });
          } catch {}
          await context.close();
        }
        await browser?.close();
        r.protocol_completed = completed;
        r.execution_failure_class = r.failure_class || null;
        r.answer = answer;
        r.benchmark_response = retrievalResponse(
          answer,
          completed,
          r.error || r.failure_class,
        );
        fs.writeFileSync(
          path.join(work, "agent_response.json"),
          JSON.stringify(r.benchmark_response, null, 2),
        );
        r.status = "evaluating";
        emit("evaluation-start", { record_id: r.record_id });
        // The stock evaluator runs only after this arm's browser and provider loop are closed.
        const result = spawnSync(
          cli,
          [
            "eval-tasks",
            "--config",
            config,
            "--output-dir",
            path.join(dir, arm),
            "--task-ids",
            String(task.task_id),
          ],
          { encoding: "utf8", timeout: 60000 },
        );
        fs.writeFileSync(
          path.join(work, "evaluator.log"),
          (result.stdout || "") + (result.stderr || ""),
        );
        try {
          const e = JSON.parse(
            fs.readFileSync(path.join(work, "eval_result.json")),
          );
          r.oracle = evaluatorSummary(e);
          if (e.status === "error") {
            r.failure_class = "evaluator";
            r.evaluation_issue = "unresolved; may be answer-dependent; not an automatic infrastructure exclusion";
          }
        } catch {
          r.failure_class = "evaluator";
          r.oracle = {
            authority: "WebArena-Verified official evaluator",
            passed: null,
            error: "No valid official eval_result.json",
          };
        }
        const unresolved = ["environment", "evaluator"].includes(
          r.failure_class,
        );
        r.strict_pass =
          completed && r.oracle?.passed === true && !r.failure_class;
        if (completed && r.oracle?.passed === false && !r.failure_class)
          r.failure_class = "answer-mismatch";
        r.operational_correctness = unresolved ? null : Number(r.strict_pass);
        r.status = unresolved
          ? "unresolved"
          : r.strict_pass
            ? "passed"
            : "failed";
        r.finished_at = now();
        emit("case-finished", { record_id: r.record_id, status: r.status });
      }
    }
  }
  batch.status = "completed";
  batch.finished_at = now();
  emit("batch-finished");
  console.log(
    JSON.stringify({
      id,
      records: batch.records.map((r) => ({
        arm: r.arm,
        task_id: r.task_id,
        status: r.status,
        score: r.oracle?.score,
      })),
    }),
  );
}
