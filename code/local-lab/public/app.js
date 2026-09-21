const $ = (id) => document.getElementById(id),
  el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
const labels = {
  visual: ["A", "Pure visual", "SCREENSHOT ONLY"],
  hybrid: ["B", "Hybrid agent", "SCREENSHOT + STRUCTURE"],
  playwright: ["C", "Playwright", "LOCATOR-BASED SCRIPT"],
};
let state,
  selectedBatch = null,
  selectedTask = null,
  lastStamp,
  figure = false;
const positions = new Map(),
  opened = new Set();
function link(text, url) {
  const a = el("a", text);
  a.href = url;
  return a;
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  setTimeout(() => ($("toast").hidden = true), 6000);
}
function metric(title, value, note) {
  const n = el("div", undefined, "metric");
  n.append(
    el("label", title),
    el("strong", value, "metric-number"),
    el("small", note),
  );
  return n;
}
function showFrame(batch, r, index) {
  const f = r.frames[index];
  if (!f) return;
  $("image-title").textContent =
    `Task ${r.task_id} / ${labels[r.arm][1]} / ${f.phase} / step ${f.step}`;
  $("full-frame").src = `/artifacts/${batch.id}/${f.file}`;
  $("image-caption").textContent = `SHA-256 ${f.sha256} · ${f.at}`;
  $("image-dialog").showModal();
}
function score(r) {
  return r.oracle?.status !== "error" && typeof r.oracle?.score === "number"
    ? r.oracle.score.toFixed(2)
    : "—";
}
function status(r) {
  return r.status === "queued"
    ? "Pending"
    : r.status === "preparing"
      ? "Preparing"
      : r.status.charAt(0).toUpperCase() + r.status.slice(1);
}
function render() {
  let admission = document.getElementById("admission");
  if (!admission) {
    admission = el("section", undefined, "protocol");
    admission.id = "admission";
    document.getElementById("protocol").before(admission);
  }
  admission.replaceChildren(
    ...(state.expansion?.benchmarks || []).map((b) => {
      const card = el("div");
      card.append(
        el("span", b.state.toUpperCase(), "eyebrow"),
        el("h3", b.name),
        el("p", b.detail),
      );
      const id=b.id==='ata'?'autonomous-tester-agent-benchmark':b.id;
      const audit=state.conformance?.benchmarks?.find(x=>x.id===id);
      if(audit) {
        const details=el('details'), list=el('ul');
        details.append(el('summary',`Not admitted · ${audit.open_gates.length} open benchmark gates`));
        list.append(...audit.open_gates.map(g=>el('li',g)));
        details.append(el('p',`Source pin: ${audit.source.pin_matches && audit.source.tracked_clean ? 'verified, tracked files unchanged' : 'unverified or changed'}`),list);
        card.append(details);
      }
      return card;
    }),
  );
  if(state.conformance) {
    const details=el('details'), list=el('ul');
    details.append(el('summary','Shared study gates · collection remains paused'));
    list.append(...state.conformance.common_open_gates.map(g=>el('li',g)));
    details.append(list,el('p',`Audit: ${state.conformance.observed_at}. Agent success rate does not determine admission.`));
    admission.append(details);
  }
  admission.title = `Readiness observed: ${state.expansion?.observed_at || "unavailable"}. Not confirmatory authorization.`;
  const batches = state.batches.filter(
    (b) => b.data_kind === "OFFICIAL_BENCHMARK_INTEGRATION",
  );
  const batch = batches.find((b) => b.id === selectedBatch) || batches[0];
  selectedBatch = batch?.id || null;
  $("batch").replaceChildren(
    ...(batches.length
      ? batches.map((b) => {
          const n = el(
            "option",
            `${new Date(b.started_at).toLocaleString("en-GB", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${b.task_ids?.length || 0} official cases`,
          );
          n.value = b.id;
          return n;
        })
      : [el("option", "No official benchmark runs")]),
  );
  if (selectedBatch) $("batch").value = selectedBatch;
  const tasks = batch?.tasks || [];
  const task = tasks.find((t) => t.task_id === selectedTask) || tasks[0];
  selectedTask = task?.task_id ?? null;
  $("task").replaceChildren(
    ...tasks.map((t) => {
      const n = el("option", `Task ${t.task_id} · Review retrieval`);
      n.value = t.task_id;
      return n;
    }),
  );
  if (task) $("task").value = String(task.task_id);
  $("model").textContent = batch?.model || state.model || "Not configured";
  $("start").disabled = Boolean(state.active) || !state.configured || !state.diagnostic_start_enabled;
  $("model").title = `Selected run model: ${batch?.model || "none"}. Next diagnostic model: ${state.model || "not configured"}. Protocol: ${state.next_protocol || "unknown"}.`;
  $("start").textContent = state.active
    ? "Benchmark running…"
    : state.diagnostic_start_enabled ? "Run diagnostic ↗" : "Collection paused";
  $("start").title = "Collection is gated while runner remediation is validated. Historical results remain unchanged.";
  $("task-title").textContent = task
    ? `Task ${task.task_id} · ${task.intent_template_id === 136 ? "Retrieve review titles" : "Retrieve reviewer names"}`
    : "Official benchmark tasks";
  $("intent").textContent =
    task?.intent ||
    "Task selection is pinned from the official WebArena-Verified release.";
  $("source").textContent = "WEBARENA-VERIFIED / SHOPPING / RETRIEVE";
  $("source-pin").textContent =
    `Source ${(batch?.source_commit || "6473f72db5dc").slice(0, 12)} · template ${task?.intent_template_id || "—"} · ${batch?.model || state.model} · ${batch?.local_protocol || state.next_protocol || "—"}`;
  $("batch-status").textContent =
    batch?.status === "completed"
      ? "Run complete"
      : batch?.status === "running"
        ? "Executing"
        : "Ready";
  $("exports").replaceChildren();
  if (batch)
    $("exports").append(
      link("JSON", `/artifacts/${batch.id}/snapshot.json`),
      link("Events", `/artifacts/${batch.id}/events.jsonl`),
    );
  const rows = batch?.records.filter((r) => r.task_id === selectedTask) || [],
    finished = rows.filter((r) => r.finished_at).length,
    scored = rows.filter(
      (r) =>
        r.oracle?.status !== "error" && typeof r.oracle?.score === "number",
    ).length,
    passed = rows.filter((r) => r.strict_pass).length,
    tokens = rows
      .flatMap((r) => r.requests)
      .reduce((n, q) => n + (q.usage?.total_tokens || 0), 0);
  $("metrics").replaceChildren(
    metric(
      "EXECUTION PROGRESS",
      `${finished} / 3`,
      "Completed strategy executions",
    ),
    metric(
      "OFFICIAL EVALUATION",
      `${scored} / 3`,
      "Cases scored by the original evaluator",
    ),
    metric(
      "VERIFIED COMPLETION",
      `${passed} / 3`,
      "Valid termination + official score = 1",
    ),
    metric(
      "MODEL USAGE",
      tokens.toLocaleString("en-US"),
      "Reported tokens · monetary cost unavailable",
    ),
  );
  $("arms").replaceChildren(
    ...Object.entries(labels).map(([arm, [letter, title, subtitle]]) => {
      const r = rows.find((r) => r.arm === arm) || {
        arm,
        task_id: selectedTask,
        status: "queued",
        frames: [],
        actions: [],
        requests: [],
      };
      const card = el("article", undefined, `arm ${r.status}`),
        header = el("div", undefined, "arm-head"),
        heading = el("div", undefined, "arm-title"),
        text = el("div");
      text.append(el("h3", title), el("p", subtitle));
      heading.append(el("span", letter, "letter"), text);
      header.append(heading, el("span", status(r), `badge ${r.status}`));
      card.append(header);
      const frames = r.frames,
        key = `${selectedBatch}:${r.record_id || arm}`,
        frame = el("div", undefined, "frame"),
        counter = el("span"),
        range = el("input"),
        frameInfo = el("pre");
      let index = positions.has(key)
        ? Math.min(positions.get(key), frames.length - 1)
        : frames.length - 1;
      const show = (i) => {
        index = i;
        const f = frames[i];
        frame.replaceChildren();
        if (f) {
          const button = el("button"),
            img = el("img");
          button.setAttribute("aria-label", `Enlarge ${title} frame ${i + 1}`);
          img.src = `/artifacts/${batch.id}/${f.file}`;
          img.alt = `${title}: ${f.phase}, step ${f.step}`;
          button.append(img);
          button.onclick = () => showFrame(batch, r, index);
          frame.append(button);
        } else
          frame.append(el("span", "AWAITING FIRST OBSERVATION", "placeholder"));
        counter.textContent = frames.length
          ? `${i + 1} / ${frames.length}`
          : "0 / 0";
        range.value = Math.max(0, i);
        frameInfo.textContent = JSON.stringify(f || null, null, 2);
      };
      show(index);
      card.append(frame);
      const timeline = el("div", undefined, "timeline"),
        prev = el("button", "‹"),
        next = el("button", "›"),
        live = el("button", "Latest");
      prev.setAttribute("aria-label", `Previous ${title} frame`);
      next.setAttribute("aria-label", `Next ${title} frame`);
      range.type = "range";
      range.min = 0;
      range.max = Math.max(0, frames.length - 1);
      range.value = Math.max(0, index);
      range.disabled = !frames.length;
      range.setAttribute("aria-label", `${title} frame timeline`);
      const move = (i) => {
        positions.set(key, i);
        show(i);
      };
      prev.onclick = () => move(Math.max(0, index - 1));
      next.onclick = () => move(Math.min(frames.length - 1, index + 1));
      range.oninput = () => move(Number(range.value));
      live.onclick = () => {
        positions.delete(key);
        show(frames.length - 1);
      };
      timeline.append(prev, range, next, counter, live);
      card.append(timeline);
      const stats = el("div", undefined, "arm-stats");
      for (const [label, value] of [
        ["ACTIONS", r.actions.length],
        ["API CALLS", r.requests.length],
        [
          "AGENT TIME",
          r.agent_wall_ms === undefined
            ? "—"
            : `${(r.agent_wall_ms / 1000).toFixed(1)} s`,
        ],
      ]) {
        const box = el("div"),
          v = el("b", String(value));
        if (label === "AGENT TIME" && r.status === "running")
          v.dataset.started = r.agent_started_at;
        box.append(el("small", label), v);
        stats.append(box);
      }
      card.append(stats);
      const outcome = el("div", undefined, "outcome");
      outcome.append(
        el(
          "span",
          `Protocol: ${r.protocol_completed === undefined ? "pending" : r.protocol_completed ? "completed" : "incomplete"}`,
        ),
        el("strong", `Official score ${score(r)}`),
      );
      card.append(outcome);
      const body = el("div", undefined, "trace-body"),
        log = el("ol", undefined, "action-log");
      body.append(el("div", "ACCEPTED ACTION TRACE", "trace-label"));
      r.actions.forEach((a, i) => {
        const row = el("li"),
          description = `${a.type || a.action} ${a.name || a.target_id || a.key || a.text || (a.delta_y !== undefined ? a.delta_y : a.x !== undefined ? `${a.x}, ${a.y}` : "")}`;
        row.title = description;
        row.append(
          el("span", String(i + 1).padStart(2, "0"), "step"),
          document.createTextNode(description),
        );
        log.append(row);
      });
      if (!r.actions.length)
        log.append(el("li", "No accepted actions recorded."));
      body.append(log);
      body.append(
        el(
          "p",
          `Failure boundary: ${r.failure_class || "none recorded"}`,
          "failure-note",
        ),
      );
      const more = el("button", "Inspect evidence", "secondary"),
        bottom = el("div", undefined, "trace-bottom"),
        details = el("div", undefined, "details-panel");
      details.hidden = !opened.has(key);
      more.onclick = () => {
        details.hidden = !details.hidden;
        if (details.hidden) opened.delete(key);
        else opened.add(key);
      };
      bottom.append(more);
      if (r.finished_at && batch)
        bottom.append(
          link(
            "Replay trace ↗",
            `/artifacts/${batch.id}/${r.record_id}-trace.zip`,
          ),
        );
      body.append(bottom);
      card.append(body);
      for (const [label, value] of [
        ["Agent answer", r.answer],
        ["Official evaluator record", r.oracle],
        ["Model requests and action output", r.requests],
        [
          "Execution diagnostics",
          {
            error: r.error,
            preparation_passed: r.preparation_passed ?? r.reset_passed ?? null,
            preparation_digest: r.preparation_digest ?? r.reset_digest ?? null,
            benchmark_reset_verified: r.reset_evidence ? r.reset_passed : null,
            reset_evidence: r.reset_evidence || 'Legacy preparation fields are not proof of database reset',
            reset_contract: batch?.reset_contract,
            protocol: batch?.local_protocol,
            model_configuration_source: batch?.model_configuration_source,
            observation_policy: batch?.observation_policy,
            observations: r.observations,
            protocol_errors: r.protocol_errors,
            execution_failure_class: r.execution_failure_class,
            evaluation_issue: r.evaluation_issue,
          },
        ],
      ]) {
        const d = el("details");
        d.append(
          el("summary", label),
          el("pre", JSON.stringify(value ?? null, null, 2)),
        );
        details.append(d);
      }
      const fdetail = el("details");
      fdetail.append(el("summary", "Selected frame provenance"), frameInfo);
      details.append(fdetail);
      card.append(details);
      return card;
    }),
  );
  $("ledger-body").replaceChildren(
    ...(batch?.records || []).map((r) => {
      const tr = el(
        "tr",
        undefined,
        r.task_id === selectedTask ? "selected" : "",
      );
      tr.tabIndex = 0;
      tr.setAttribute(
        "aria-label",
        `Select task ${r.task_id}, ${labels[r.arm][1]}`,
      );
      const choose = () => {
        selectedTask = r.task_id;
        render();
      };
      tr.onclick = choose;
      tr.onkeydown = (e) => {
        if (e.key === "Enter") choose();
      };
      const fields = [
        String(r.task_id),
        labels[r.arm][1],
        status(r),
        score(r),
        String(r.actions.length),
        r.requests
          .reduce((n, q) => n + (q.usage?.total_tokens || 0), 0)
          .toLocaleString("en-US"),
        r.agent_wall_ms === undefined
          ? "—"
          : `${(r.agent_wall_ms / 1000).toFixed(1)} s`,
        r.failure_class || "—",
      ];
      fields.forEach((s) => tr.append(el("td", s)));
      return tr;
    }),
  );
  $("foot").textContent =
    `PSS-WebTest · ${batch?.id || "Awaiting benchmark run"} · Integration evidence, not confirmatory results`;
  $("environment").textContent = state.benchmark?.navigation_verified
    ? "Shopping environment: verified HTTP 200"
    : "Shopping environment: validation pending";
}
$("batch").onchange = (e) => {
  selectedBatch = e.target.value;
  selectedTask = null;
  render();
};
$("task").onchange = (e) => {
  selectedTask = Number(e.target.value);
  render();
};
$("figure").onclick = () => {
  figure = !figure;
  document.body.classList.toggle("figure-mode", figure);
  $("figure").setAttribute("aria-pressed", String(figure));
  if (figure) {
    const exit = el("button", "Exit figure view", "secondary figure-exit");
    exit.id = "exit-figure";
    exit.onclick = () => {
      $("figure").click();
    };
    document.body.append(exit);
  } else $("exit-figure")?.remove();
};
$("close-image").onclick = () => $("image-dialog").close();
$("image-dialog").onclick = (e) => {
  if (e.target === $("image-dialog")) $("image-dialog").close();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && figure) $("figure").click();
});
$("start").onclick = async () => {
  if (
    !confirm(
      `Run the pinned official WebArena-Verified selection with three strategies? Local screenshots will be sent to Qwen. Task IDs: ${state.selection?.task_ids?.join(", ") || "see pinned selection"}.`,
    )
  )
    return;
  try {
    const res = await fetch("/api/start", {
        method: "POST",
        headers: { "x-local-token": state.token },
      }),
      data = await res.json();
    if (!res.ok) throw new Error(data.error);
    selectedBatch = data.id;
    selectedTask = null;
    await poll();
  } catch (e) {
    toast(e.message);
  }
};
async function poll() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state = await response.json();
    const active = state.batches.find(
      (b) =>
        b.status === "running" &&
        b.data_kind === "OFFICIAL_BENCHMARK_INTEGRATION",
    );
    if (active && !state.active) state.active = active.id;
    $("connection").textContent =
      `● Local service online · ${new Date().toLocaleTimeString("en-GB")}`;
    const stamp = JSON.stringify(state);
    if (stamp !== lastStamp) {
      lastStamp = stamp;
      render();
    }
  } catch (e) {
    $("connection").textContent = `Connection unavailable · ${e.message}`;
  }
}
await poll();
setInterval(() => {
  poll();
  document.querySelectorAll("[data-started]").forEach((n) => {
    if (n.dataset.started)
      n.textContent = `${((Date.now() - Date.parse(n.dataset.started)) / 1000).toFixed(1)} s`;
  });
}, 1000);
