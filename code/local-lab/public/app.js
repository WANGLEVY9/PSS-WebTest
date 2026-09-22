import {requestUsage,tokenLabel} from './resource-accounting.mjs';
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
  let coverage=document.getElementById('development-coverage');
  if(!coverage){coverage=el('section',undefined,'ledger-section');coverage.id='development-coverage';document.querySelector('.selectors').before(coverage);}
  const acceptance=state.development_acceptance;
  const heading=el('div',undefined,'section-heading');
  heading.append(el('h2','Development acceptance'),el('span','60 official tasks · four profiles · not confirmatory','muted'));
  coverage.replaceChildren(heading);
  if(acceptance?.status==='published'){
    const cards=el('div',undefined,'metrics');
    cards.append(metric('PLANNED OPPORTUNITIES',acceptance.planned,'240 base + 120 stability repeats'),
      metric('EXECUTION RECEIPTS',acceptance.received,'Not a count of successful tasks'),
      metric('EVIDENCE READY',acceptance.evidence_ready,'Valid failures may count; external faults do not'),
      metric('FIXTURE CELLS',`${acceptance.fixture_ready} / 12`,'Reset, isolation, boundaries and native evaluation'));
    coverage.append(cards);
    const details=el('details'),table=el('table'),head=el('thead'),hr=el('tr'),body=el('tbody');
    details.append(el('summary',`Inspect coverage · ${acceptance.campaign_id} · ${acceptance.candidate_version}`));
    ['Benchmark','AgentLab visual','AgentLab hybrid','Browser Use hybrid','Playwright'].forEach(v=>hr.append(el('th',v)));
    head.append(hr);table.append(head,body);
    for(const b of acceptance.benchmarks){const row=el('tr');row.append(el('th',b.benchmark.toUpperCase()));for(const p of b.profiles)row.append(el('td',`${p.ready} / ${p.planned}`));body.append(row);}
    const wrap=el('div',undefined,'table-wrap');wrap.append(table);details.append(wrap,
      el('p',`${acceptance.note} Snapshot: ${acceptance.published_at}`,'muted'));coverage.append(details);
  }else coverage.append(el('p',acceptance?.status==='invalid-or-drifted'
      ?'Coverage snapshot failed integrity checks. No readiness claim is available.'
      :'No measured development coverage snapshot has been published. Planned tasks are not completed experiments.','muted'));
  renderSpending();
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
        if(audit.component_evidence?.length) {
          const evidence=el('details'), items=el('ul');
          evidence.append(el('summary','Engineering checks · not task success'));
          items.append(...audit.component_evidence.map(item=>el('li',item)));
          evidence.append(items); card.append(evidence);
        }
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
  if(state.execution_gate?.allowed !== true) {
    const details=el('details'), list=el('ul');
    details.append(el('summary','Execution gate · blocked before task or model execution'));
    list.append(...(state.execution_gate?.reasons || ['Execution evidence unavailable']).map(g=>el('li',g)));
    details.append(list);admission.append(details);
  }
  if(state.reset_preflight) {
    const r=state.reset_preflight, details=el('details'), list=el('ul');
    details.append(el('summary',`Reset preflight · ${r.status} · ${r.completed_cycles ?? '—'}/3 cycles`));
    list.append(el('li',`Phase: ${r.phase || 'unavailable'}`),
      el('li',`Scoped evidence verified: ${r.audit?.verified === true ? 'yes' : 'no'}. Not benchmark admission.`));
    if(r.homepage) list.append(el('li',`Last homepage: HTTP ${r.homepage.status}, ${r.homepage.elapsed_ms} ms`));
    details.append(list);admission.append(details);
  }
  if(state.provider_configuration) {
    const p=state.provider_configuration, card=el('details');
    card.append(el('summary',`Next-run provider · ${p.provider || 'not configured'} · ${p.model || 'model required'}`),
      el('p',p.error || `API: ${p.api}. Key configured: ${p.configured?'yes':'no'}. Configuration is not live connectivity or benchmark admission.`));
    admission.append(card);
  }
  if(state.study_design) {
    const s=state.study_design,card=el('details');
    card.append(el('summary',`Active study · ${s.protocol_id} · ${s.configuration_count} configurations × 12 rounds`),
      el('p',`Selected denominator: ${s.scale.tasks.toLocaleString('en-US')} tasks; ${s.scale.scheduled_opportunities.toLocaleString('en-US')} scheduled opportunities. Existing collection is user-reported; local import coverage is unknown. GPT supplementation is the priority.`),
      el('p','Local diagnostic batches below are not the global research inventory. Discovery: D1–D2. Validation: V1–V10. Runtime budgets must match the original collection settings.'));
    admission.append(card);
  }
  if(state.sponsor_readiness) {
    const r=state.sponsor_readiness, card=el('details'), list=el('ul');
    card.append(el('summary','Sponsor handoff · benchmark setup incomplete'),
      el('p',`Read-only audit: ${r.observed_at}. Live GPT verified: ${r.live_gpt_verified?'yes':'no'}. Adding a key does not bypass study gates.`));
    list.append(...r.checks.filter(c=>!c.passed).map(c=>el('li',`${c.id}: ${typeof c.detail==='string'?c.detail:'not verified'}`)));
    card.append(list);admission.append(card);
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
  $("start").disabled = Boolean(state.active) || !state.configured || !state.diagnostic_start_enabled || state.execution_gate?.allowed !== true || state.spending?.ready !== true;
  $("model").title = `Selected run model: ${batch?.model || "none"}. Next diagnostic model: ${state.model || "not configured"}. Protocol: ${state.next_protocol || "unknown"}.`;
  $("start").textContent = state.active
    ? "Benchmark running…"
    : state.diagnostic_start_enabled && state.execution_gate?.allowed === true ? "Run diagnostic ↗" : "Collection paused";
  $("start").title = state.execution_gate?.reasons?.join('; ') || "Collection is gated while runner remediation is validated. Historical results remain unchanged.";
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
    requests = rows.flatMap((r) => r.requests || []),
    usage = requestUsage(requests);
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
      tokenLabel(requests),
      `${usage.reported}/${usage.expected} calls report usage · cost unavailable`,
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
            model_routing: batch?.model_routing || 'Legacy run: route policy was not recorded',
            token_accounting: requestUsage(r.requests),
            phase_timings: r.phase_timings || 'Legacy run: phase timings unavailable',
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
        tokenLabel(r.requests),
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
      `Run the pinned official WebArena-Verified selection with three strategies? Local screenshots (plus visible controls for Hybrid) will be sent to ${state.provider} / ${state.model}. Task IDs: ${state.selection?.task_ids?.join(", ") || "see pinned selection"}.`,
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
    lastStamp=null;
    $("connection").textContent = `Connection unavailable · ${e.message}`;
    $("start").disabled = true;
    $("pause-spend").disabled = true;
    $("spend-status").textContent = 'Ledger connection lost. Values may be stale; launch is disabled.';
  }
}
const money=n=>typeof n==='number'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'CNY'}).format(n/1e6):'Unknown';
const alertLabels={warning:'80% warning threshold reached',critical:'90% critical threshold reached',stop_new_tasks:'95% reached; new tasks stopped',cap:'Total cap reached',
  'charge-unknown':'Usage unconfirmed; full reservation retained','provider-budget':'Provider budget exhausted; requests paused',
  'provider-auth':'Provider authentication failed; requests paused','provider-model-mismatch':'Returned model differs from the price binding; requests paused',
  'global-cap':'Request would exceed the total cap; blocked','task-cap':'Request would exceed the task cap; blocked',
  'task-request-limit':'Task request limit reached','task-deadline':'Task deadline reached',
  'reservation-overrun':'Charge exceeded reservation; all new requests locked','operator-pause':'Operator paused requests',paused:'Request blocked while paused',
  'stop-new-tasks':'New task admission blocked','duplicate-request':'Duplicate request blocked'};
function renderSpending() {
  const s=state.spending,p=s?.policy;
  $('pause-spend').disabled=!p;
  if(!p) {$('spend-status').textContent=s?.error||'Ledger unavailable; launch is blocked.';return;}
  $('pause-spend').textContent=s.paused?'Lift manual pause':'Pause new requests';
  const exposure=s.exposure_micro_cny;
  $('spending').dataset.severity=exposure>=p.critical_micro_cny||s.paused?'critical':exposure>=p.warning_micro_cny?'warning':'normal';
  $('spend-status').textContent=s.paused?'Paused: new model requests are blocked. In-flight requests may still incur charges.':s.pricing_error?
    'Pricing not ready: verify model rates and input bounds. Paid execution remains blocked.':!s.ready?'Budget gate closed. Check alerts below; restarting does not restore the allowance.':
      exposure>=p.critical_micro_cny?'Critical: 90% of the budget is committed. New tasks stop at 95%.':
      exposure>=p.warning_micro_cny?'Warning: 80% of the budget is committed. Review the remaining experiment scope.':'Budget permits new tasks. Experiment acceptance gates still apply.';
  $('spend-metrics').replaceChildren(metric('Total budget',money(p.cap_micro_cny),'Shared across runs; no monthly reset'),
    metric('Accounted cost',money(s.known_micro_cny),'Verified rates and returned usage'),
    metric('Unconfirmed / reserved',money(s.held_micro_cny||0),`${s.unknown_requests||0} requests awaiting confirmation`),
    metric('Available to reserve',money(Math.max(0,p.cap_micro_cny-exposure)),'After accounted costs and reservations'));
  $('spend-progress').max=p.cap_micro_cny;$('spend-progress').value=exposure;
  $('spend-progress').setAttribute('aria-valuetext',`${money(exposure)} / ${money(p.cap_micro_cny)}`);
  $('spend-thresholds').replaceChildren(...[['warning','80% Warning'],['critical','90% Critical'],['stop_new_tasks','95% Stop new tasks'],['cap','100% Request cap']]
    .map(([key,label])=>el('span',`${label} · ${money(p[key+'_micro_cny'])}`)));
  $('spend-limits').textContent=`Per execution (task × configuration × round): ${money(p.task_cap_micro_cny)}, up to ${p.task_max_requests} requests, ${p.task_timeout_ms/1000} seconds and ${p.task_max_actions} actions. Stricter experiment limits take precedence. Conversion: 1 USD = ${p.fx_cny_per_usd} CNY (planning assumption, not a live rate).`;
  $('spend-alerts').replaceChildren(...(s.alerts.length?s.alerts.map(a=>el('li',`${new Date(a.at*1000).toLocaleString('en-GB')} · ${alertLabels[a.kind]||a.kind} · Committed ${money(a.exposure)}`)):[el('li','No ledger alerts. This does not authorize confirmatory experiments.')]));
  $('spend-tasks').replaceChildren(...s.tasks.map(t=>el('li',`${t.id} · ${t.requests} requests · Committed ${money(t.exposure_micro_cny)}`)));
}
$('pause-spend').onclick=async()=>{
  $('pause-spend').disabled=true;
  try {
    const endpoint=state.spending.paused?'resume':'pause';
    const r=await fetch(`/api/budget/${endpoint}`,{method:'POST',headers:{'x-local-token':state.token}});
    if(!r.ok)throw Error('Budget control failed. Check the ledger service.');
    await poll();
  } catch(e) {toast(e.message);}
};
await poll();
setInterval(() => {
  poll();
  document.querySelectorAll("[data-started]").forEach((n) => {
    if (n.dataset.started)
      n.textContent = `${((Date.now() - Date.parse(n.dataset.started)) / 1000).toFixed(1)} s`;
  });
}, 1000);
