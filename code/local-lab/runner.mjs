import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createVolcengineCuaDriver } from "../src/arms/volcengine-cua-driver.mjs";
import { createVolcengineHybridDriver } from "../src/arms/volcengine-hybrid-driver.mjs";
import { evaluateJuiceShopUiSearch } from "../src/oracles/juice-shop-ui-search.mjs";
import { ARMS, summarize, assess } from "./metrics.mjs";
import { acquireLock } from "./lock.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const code = path.resolve(root, "..");
dotenv.config({ path: path.join(code, ".env"), quiet: true });
const artifactRoot = path.join(code, "artifacts", "local-runtime");
const release = acquireLock(artifactRoot);
process.once("exit", release);
const id = process.argv[2] || `local-${Date.now()}`;
if (!/^local-[\w-]+$/.test(id)) throw new Error("Invalid batch ID");
const dir = path.join(artifactRoot, id);
fs.mkdirSync(dir, { recursive: true });
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
const now = () => new Date().toISOString();
const model = process.env.PSS_LOCAL_MODEL || "qwen3-vl-flash";
process.env.CUA_MODEL = model;
if (
  process.env.CUA_PROVIDER !== "aliyun" ||
  !model?.startsWith("qwen") ||
  !process.env.CUA_API_KEY
)
  throw new Error("Local smoke requires a configured Qwen model in code/.env");
const base = "http://127.0.0.1:3000";
const intent =
  "Search the Juice Shop catalog for apple using the visible search control. Finish only when the search results show Apple Juice (1000ml), Apple Pomace and Pineapple Juice (1000ml), without Banana Juice (1000ml). Dismiss welcome or cookie overlays if necessary. Return pass when complete.";
const batch = {
  schema_version: "local-runtime-v1",
  id,
  runner_pid: process.pid,
  started_at: now(),
  status: "running",
  data_kind: "LIVE_ENGINEERING",
  confirmatory_eligible: false,
  benchmark: "local-juice-shop-engineering",
  task_id: "juice-shop-product-search",
  intent,
  model,
  provider: "aliyun",
  framework: "PSS native diagnostic driver (not AgentLab / Browser Use)",
  local_protocol: "generic-web-v1-normalized-json-penalty0-v4",
  frozen_protocol: false,
  budget: {
    max_decisions: 16,
    agent_timeout_ms: 240000,
    request_timeout_ms: 45000,
    retries: 0,
  },
  source_revision: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: code,
    encoding: "utf8",
  }).trim(),
  implementation_digest: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  dependency_digests: Object.fromEntries(
    [
      "src/arms/volcengine-cua-driver.mjs",
      "src/arms/volcengine-hybrid-driver.mjs",
      "src/arms/observation-contracts.mjs",
      "src/oracles/juice-shop-ui-search.mjs",
      "local-lab/metrics.mjs",
    ].map((p) => [p, sha(fs.readFileSync(path.join(code, p)))]),
  ),
  order: [...ARMS].sort((a, b) => sha(id + a).localeCompare(sha(id + b))),
  records: ARMS.map((arm) => ({
    arm,
    status: "queued",
    actions: [],
    frames: [],
    requests: [],
    oracle: null,
    strict_pass: false,
    operational_correctness: null,
  })),
};
function persist() {
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
  persist();
}
const cleanError = (e) =>
  String(e?.message || e)
    .replaceAll(process.env.CUA_API_KEY, "[REDACTED]")
    .slice(0, 500);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function reset(record) {
  // Only this disposable, volume-free container is managed. Other applications are untouched.
  try {
    execFileSync("docker", ["stop", "pss-juice-shop"], {
      stdio: "pipe",
      timeout: 20000,
    });
  } catch {}
  try {
    execFileSync("docker", ["rm", "pss-juice-shop"], {
      stdio: "pipe",
      timeout: 10000,
    });
  } catch {}
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      "pss-juice-shop",
      "-p",
      "127.0.0.1:3000:3000",
      "bkimminich/juice-shop:v20.0.0",
    ],
    { stdio: "pipe", timeout: 60000 },
  );
  record.image_id = execFileSync(
    "docker",
    ["inspect", "pss-juice-shop", "--format", "{{.Image}}"],
    { encoding: "utf8" },
  ).trim();
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(base + "/rest/products/search?q=apple", {
        signal: AbortSignal.timeout(3000),
      });
      const p = await res.json();
      if (res.ok && p.data?.length === 3) {
        record.reset_digest = sha(
          JSON.stringify(
            p.data
              .map(({ id, name, price }) => ({ id, name, price }))
              .sort((a, b) => a.id - b.id),
          ),
        );
        record.reset_passed = true;
        return;
      }
    } catch {}
    await delay(1000);
  }
  throw new Error("Juice Shop readiness did not pass");
}

// Projection is regenerated per observation. No selectors, stable IDs, URL or hidden state enter the model.
async function projection(page) {
  return page.evaluate(() => ({
    controls: [
      ...document.querySelectorAll(
        "a,button,input:not([type=hidden]),textarea,[role=button]",
      ),
    ]
      .flatMap((el) => {
        const b = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        const x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        if (
          b.width < 1 ||
          b.height < 1 ||
          s.visibility !== "visible" ||
          s.display === "none" ||
          Number(s.opacity) === 0 ||
          x < 0 ||
          x >= innerWidth ||
          y < 0 ||
          y >= innerHeight
        )
          return [];
        const hit = document.elementFromPoint(x, y);
        if (!hit || !(el.contains(hit) || hit.contains(el))) return [];
        const role =
          el.getAttribute("role") ||
          (el.tagName === "A"
            ? "link"
            : /INPUT|TEXTAREA/.test(el.tagName)
              ? "textbox"
              : "button");
        return [
          {
            role,
            name: (
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.innerText ||
              ""
            )
              .trim()
              .slice(0, 300),
            interaction: role === "textbox" ? "type" : "click",
            state: { disabled: Boolean(el.disabled) },
            bounding_box: { x: b.x, y: b.y, width: b.width, height: b.height },
          },
        ];
      })
      .slice(0, 160)
      .map((c, i) => ({ ...c, target_id: `c${i}` })),
  }));
}
emit("batch-start");
for (const arm of batch.order) {
  const r = batch.records.find((r) => r.arm === arm);
  let browser, page, agentStarted, capture;
  let stage = "reset";
  let completed = false;
  r.started_at = now();
  r.status = "resetting";
  emit("arm-start", { arm });
  try {
    await reset(r);
    emit("reset-ready", { arm, digest: r.reset_digest });
    stage = "environment";
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: false,
    });
    page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(1800);
    r.status = "running";
    stage = "agent";
    const started = Date.now();
    agentStarted = started;
    r.agent_started_at = now();
    async function frame(phase, step) {
      const image = await page.screenshot({
        type: "jpeg",
        quality: 75,
        animations: "disabled",
      });
      const name = `${arm}-${String(r.frames.length).padStart(3, "0")}.jpg`;
      fs.writeFileSync(path.join(dir, name), image);
      // URL is observer-only: never passed to driver, prompt, progress logic or stopping rule.
      r.frames.push({
        file: name,
        sha256: sha(image),
        at: now(),
        phase,
        step,
        url: page.url(),
      });
      emit("frame", { arm, phase, step });
      return `data:image/jpeg;base64,${image.toString("base64")}`;
    }
    capture = frame;
    let visibleControls = [];
    async function act(action) {
      if (Date.now() - started >= batch.budget.agent_timeout_ms)
        throw new Error("agent wall-time budget exceeded");
      if (action.type === "click" || action.type === "double_click") {
        let { x, y } = action;
        if (action.target_id) {
          const c = visibleControls.find(
            (c) => c.target_id === action.target_id,
          );
          if (!c) throw new Error("Unknown observation-local target");
          x = c.bounding_box.x + c.bounding_box.width / 2;
          y = c.bounding_box.y + c.bounding_box.height / 2;
        }
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < 0 ||
          x >= 1280 ||
          y < 0 ||
          y >= 720
        )
          throw new Error("Pointer outside viewport");
        await page.mouse[action.type === "click" ? "click" : "dblclick"](x, y);
      } else if (action.type === "type") await page.keyboard.type(action.text);
      else if (action.type === "keypress")
        await page.keyboard.press(
          {
            ENTER: "Enter",
            ESC: "Escape",
            ESCAPE: "Escape",
            "CTRL+A": "ControlOrMeta+A",
            TAB: "Tab",
          }[action.key.toUpperCase()] || action.key,
        );
      else if (action.type === "scroll")
        await page.mouse.wheel(0, action.delta_y);
      else if (action.type === "wait")
        await delay(Math.min(action.ms || 500, 3000));
      else throw new Error("Unsupported action");
      r.actions.push({ step: r.actions.length, at: now(), ...action });
      emit("action", { arm, action });
      await delay(500);
    }
    const fetchImpl = async (url, init) => {
      const q = {
        at: now(),
        step: r.frames.at(-1)?.step,
        status: "pending",
        request_digest: sha(init.body),
      };
      r.requests.push(q);
      emit("provider-start", { arm });
      const t = Date.now();
      const remaining = batch.budget.agent_timeout_ms - (Date.now() - started);
      if (remaining <= 0) throw new Error("agent wall-time budget exceeded");
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.any(
            [
              init.signal,
              AbortSignal.timeout(Math.max(1, Math.min(45000, remaining))),
            ].filter(Boolean),
          ),
        });
        const p = await res.clone().json();
        q.http_status = res.status;
        q.status = res.ok ? "received" : "error";
        q.usage = p.usage || null;
        q.finish_reason = p.choices?.[0]?.finish_reason || null;
        // Persist action output, not hidden reasoning, headers, credentials or image payloads.
        q.output =
          p.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
          p.choices?.[0]?.message?.content?.slice(0, 1500) ||
          null;
        return res;
      } catch (e) {
        q.status = "error";
        q.error = cleanError(e);
        throw e;
      } finally {
        q.latency_ms = Date.now() - t;
        emit("provider-end", { arm });
      }
    };
    await frame("initial", 0);
    if (arm === "playwright") {
      for (const label of ["Dismiss", "Me want it!"]) {
        const button = page.getByText(label, { exact: true });
        if (await button.isVisible()) {
          await button.click();
          r.actions.push({ type: "locator-click", name: label });
          await frame("after-action", r.actions.length);
        }
      }
      await page.getByRole("button", { name: "Open search" }).click();
      r.actions.push({ type: "locator-click", name: "Open search" });
      await frame("after-action", r.actions.length);
      await page.getByRole("textbox").first().fill("apple");
      r.actions.push({ type: "locator-fill", text: "apple" });
      await frame("after-action", r.actions.length);
      await page.keyboard.press("Enter");
      r.actions.push({ type: "keypress", key: "Enter" });
      await delay(800);
      completed = true;
      r.emitted_verdict = "pass";
    } else {
      const env = {
        ...process.env,
        CUA_ALIYUN_ACTION_MODE: "json",
        CUA_MAX_DECISION_RETRIES: "0",
        PSS_PROMPT_PROFILE: "generic-web-v1",
        CUA_COORDINATE_MODE: "normalized_1000",
      };
      const options = {
        env,
        executeAction: act,
        fetchImpl,
        timeoutMs: 45000,
        maxRetries: 0,
        coordinateMode: "normalized_1000",
        wallTimeoutMs: 240000,
        doneVerdicts: ["pass"],
      };
      const driver =
        arm === "visual"
          ? createVolcengineCuaDriver({
              ...options,
              observeScreenshot: ({ step }) => frame("observation", step),
            })
          : createVolcengineHybridDriver({
              ...options,
              hybridActionMode: "semantic",
              observeHybrid: async ({ step }) => {
                const screenshot = await frame("observation", step);
                const p = await projection(page);
                visibleControls = p.controls;
                return { screenshot, pageStructure: p };
              },
            });
      r.protocol = {
        ...driver.getProtocolResolution(),
        effective_coordinate_mode: "normalized_1000",
        local_prompt_profile: "generic-web-v1",
        frozen: false,
      };
      emit("driver-ready", { arm });
      for (let step = 0; step < batch.budget.max_decisions; step++) {
        const observation = await driver.observe({ step });
        const decision = await driver.decide({ intent, observation, step });
        if (decision.type === "done") {
          completed = decision.verdict === "pass";
          r.emitted_verdict = decision.verdict;
          break;
        }
        await driver.act(decision.action);
      }
      if (!completed) r.failure_class = "step-budget";
    }
    r.agent_wall_ms = Date.now() - started;
    if (r.agent_wall_ms > 240000) {
      completed = false;
      r.failure_class = "time-budget";
    }
    await frame("final", r.actions.length);
  } catch (e) {
    r.error = cleanError(e);
    r.failure_class =
      stage !== "agent"
        ? stage
        : /wall-time budget/i.test(r.error)
          ? "time-budget"
          : /abort|timeout/i.test(r.error)
            ? "provider-timeout"
            : /non-progressing/i.test(r.error)
              ? "grounding-nonprogress"
              : /valid JSON|requires|unsupported decision|coordinates/i.test(
                    r.error,
                  )
                ? "model-output-contract"
                : /provider|fetch/i.test(r.error)
                  ? "provider"
                  : "agent-or-action";
    emit("error", { arm, error: r.error });
  } finally {
    if (agentStarted) r.agent_wall_ms = Date.now() - agentStarted;
    if (capture && r.frames.at(-1)?.phase !== "final")
      try {
        await capture("failure-final", r.actions.length);
      } catch (e) {
        r.capture_error = cleanError(e);
      }
    // No evaluator result is ever fed back into the agent or used to extend its budget.
    if (page) {
      try {
        r.oracle = await evaluateJuiceShopUiSearch(page);
      } catch (e) {
        r.failure_class = "evaluator";
        r.oracle_error = cleanError(e);
      }
      try {
        await page
          .context()
          .tracing.stop({ path: path.join(dir, `${arm}-trace.zip`) });
      } catch (e) {
        r.trace_error = cleanError(e);
      }
    }
    if (completed && r.oracle?.passed === false && !r.failure_class)
      r.failure_class = "verdict-postcondition-disagreement";
    await browser?.close();
    r.protocol_completed = completed;
    r.finished_at = now();
    r.wall_time_ms = Date.parse(r.finished_at) - Date.parse(r.started_at);
    Object.assign(
      r,
      assess({ completed, oracle: r.oracle, failure_class: r.failure_class }),
    );
    r.status = r.strict_pass
      ? "passed"
      : r.operational_correctness === null
        ? "unresolved"
        : "failed";
    emit("arm-finished", { arm, status: r.status });
  }
}
batch.status = "completed";
batch.finished_at = now();
emit("batch-finished");
console.log(
  JSON.stringify({ id, status: batch.status, metrics: batch.metrics }),
);
