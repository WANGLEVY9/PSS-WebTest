const state = { filter: 'all', data: null, selectedRunId: null, runDetail: null, frameIndex: 0, application: 'all', task: 'all', condition: 'all', selectedBlock: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatMs = (value) => value === null || value === undefined ? '—' : value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}s` : `${value}ms`;

function outcome(record) {
  if (record.status === 'completed' && record.checkpoint_reached && record.emitted_verdict === record.ground_truth_verdict) return ['STRICT PASS', 'pass'];
  if (record.checkpoint_reached) return ['CHECKPOINT ONLY', 'partial'];
  return [record.failure_category ?? record.status ?? 'FAILED', 'fail'];
}
function actionLabel(action = {}) {
  const detail = action.type === 'click' || action.type === 'double_click' ? `@ ${action.x}, ${action.y}`
    : action.type === 'type' ? `typed value redacted · ${action.text_length ?? '?'} chars`
    : action.type === 'keypress' ? action.key
    : action.type === 'wait' ? `${action.ms ?? 500}ms`
    : action.type === 'scroll' ? `${action.delta_y}px` : '';
  return `${action.type ?? 'event'}${detail ? ` · ${detail}` : ''}`;
}
function stateLabel(state = {}) {
  if (!state) return '';
  const facts = [];
  if (state.milestone) facts.push(state.milestone);
  if (state.title_filled) facts.push('title filled');
  if (state.editor_focused) facts.push('editor focused');
  if (state.save_clicked) facts.push(state.saved_page_visible ? 'save completed' : 'save submitted');
  return facts.join(' · ');
}
function filteredRecords(records = []) {
  return records.filter((record) => (state.application === 'all' || record.application_id === state.application)
    && (state.task === 'all' || `${record.application_id}/${record.task_id}` === state.task)
    && (state.condition === 'all' || record.condition === state.condition));
}
function recordKey(record) { return `${record.application_id}/${record.task_id}`; }
function shortId(value, length = 14) { const text = String(value ?? '—'); return text.length > length ? `${text.slice(0, length)}…` : text; }
function populateSelect(selector, options, selected, allLabel) {
  const select = $(selector); const values = [`<option value="all">${escapeHtml(allLabel)}</option>`, ...options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)].join('');
  select.innerHTML = values; select.value = options.some((option) => option.value === selected) ? selected : 'all';
}
function renderReplayFilters(records) {
  const applications = [...new Set(records.map((record) => record.application_id))].sort().map((value) => ({ value, label: value }));
  const tasks = [...new Map(records.map((record) => [recordKey(record), { value: recordKey(record), label: `${record.application_id} / ${record.task_id}` }])).values()].sort((a, b) => a.label.localeCompare(b.label));
  const conditions = [...new Set(records.map((record) => record.condition))].sort().map((value) => ({ value, label: value }));
  populateSelect('#replay-application', applications, state.application, 'All applications');
  populateSelect('#replay-task', tasks, state.task, 'All workflows');
  populateSelect('#replay-condition', conditions, state.condition, 'All conditions');
}
function matchingArmRecords(records) {
  const visible = filteredRecords(records);
  if (!visible.length) return [];
  const selected = state.selectedBlock ? visible.filter((record) => record.randomization_block === state.selectedBlock) : visible;
  const source = selected.length ? selected : visible;
  return ['visual', 'hybrid', 'playwright'].map((arm) => source.find((record) => record.arm === arm) ?? null);
}
function renderArmComparison(records) {
  const arms = matchingArmRecords(records);
  const anchor = arms.find(Boolean);
  $('#replay-context').textContent = anchor ? `${anchor.application_id} / ${anchor.task_id} · ${anchor.condition}${anchor.randomization_block ? ` · block ${shortId(anchor.randomization_block, 24)}` : ''}` : 'No records match the current filters.';
  $('#arm-comparison').innerHTML = arms.map((record) => {
    if (!record) return `<article class="arm-compare-card missing"><div class="arm-compare-head"><span class="arm-label">—</span><span class="compare-status">NOT OBSERVED</span></div><strong>Missing arm record</strong><small>This matched block has no readable run for this strategy.</small></article>`;
    const [label, className] = outcome(record);
    return `<button type="button" class="arm-compare-card arm-${escapeHtml(record.arm)} ${record.run_id === state.selectedRunId ? 'selected' : ''}" data-run-id="${escapeHtml(record.run_id)}"><div class="arm-compare-head"><span class="arm-label arm-${escapeHtml(record.arm)}">${escapeHtml(record.arm)}</span><span class="outcome ${className}">${escapeHtml(label)}</span></div><strong>${record.replay?.available ? `${record.replay.frame_count} frames` : 'No frame archive'}</strong><small>${escapeHtml(record.failure_category ?? 'independent oracle matched')} · ${formatMs(record.wall_time_ms)} · ${record.actions ?? '—'} actions</small><span class="compare-model">${escapeHtml(record.provider_id ?? 'scripted')} / ${escapeHtml(record.model_id ?? 'deterministic')}</span></button>`;
  }).join('');
}

function renderSuts(suts) {
  $('#sut-count').textContent = `${suts.filter((sut) => sut.reachable).length}/${suts.length}`;
  $('#sut-grid').innerHTML = suts.map((sut) => `<article class="sut"><div class="sut-header"><h3>${escapeHtml(sut.name)}</h3><span class="tag ${sut.reachable ? 'ok' : 'down'}">${sut.reachable ? 'REACHABLE' : 'OFFLINE'}</span></div><p>${escapeHtml(sut.url.replace(/^https?:\/\//, ''))} · ${sut.http_status ?? sut.error ?? '—'} · ${formatMs(sut.latency_ms)}</p></article>`).join('');
}
function renderLiveRun(data) {
  const latest = data.recent_records?.[0] ?? null;
  const status = latest ? outcome(latest)[0] : 'IDLE';
  const title = latest ? `${latest.application_id} · ${latest.task_id}` : 'Waiting for a local run';
  const intent = latest
    ? `${latest.condition} · ${latest.arm} · ${latest.provider_id ?? (latest.arm === 'playwright' ? 'scripted' : 'unknown-provider')} / ${latest.model_id ?? (latest.arm === 'playwright' ? 'deterministic' : 'unknown-model')} · ${status.toLowerCase()}`
    : 'Select a task row or a run record to inspect its screenshots, action trace, and independent oracle state.';
  $('#current-test-title').textContent = title;
  $('#current-task-intent').textContent = intent;
  $('#framework-name').textContent = latest?.arm === 'playwright' ? 'Playwright' : latest?.arm ? `${latest.arm} agent` : '—';
  $('#current-step').textContent = latest ? `${latest.actions ?? 0} actions` : '—';
  $('#current-batch').textContent = latest?.randomization_block ? shortId(latest.randomization_block, 12) : `${data.ledger.record_count ?? 0} runs`;
  $('#current-workers').textContent = latest ? `${latest.arm} / ${latest.application_id}` : '—';
  $('#worker-count').textContent = `${latest ? 1 : 0} online`;
  $('#worker-strip').innerHTML = ['visual', 'hybrid', 'playwright'].map((arm) => {
    const record = data.recent_records?.find((item) => item.arm === arm);
    const label = record ? `${record.application_id} / ${record.task_id}` : 'ready for next task';
    return `<div class="worker-card ${record ? 'active' : ''}"><strong>${arm === 'playwright' ? 'accessibility-locator Playwright' : `${arm} agent`}</strong><small>${escapeHtml(label)} · ${record ? outcome(record)[0].toLowerCase() : 'READY'}</small></div>`;
  }).join('');
}
function taskClass(task) { if (!task.evidence.n) return ''; return task.evidence.all_arms_observed ? 'observed' : 'partial'; }
function renderTasks(tasks) {
  const visible = tasks.filter((task) => state.filter === 'all' || (state.filter === 'observed' ? task.evidence.n > 0 : task.status === 'candidate'));
  $('#task-count').textContent = tasks.length;
  $('#task-grid').innerHTML = visible.length ? visible.map((task) => `<button type="button" class="task ${taskClass(task)} ${state.task === `${task.application_id}/${task.id}` ? 'selected' : ''}" data-task-key="${escapeHtml(`${task.application_id}/${task.id}`)}"><div class="task-top"><span class="tag">${escapeHtml(task.application_id.toUpperCase())}</span><span class="tag">${escapeHtml(task.status.toUpperCase())}</span></div><h3>${escapeHtml(task.id)}</h3><div class="task-meta"><span class="pill">${escapeHtml(task.complexity)}</span><span class="pill">${escapeHtml(task.oracle_authority)}</span></div><div class="task-footer"><span>${task.evidence.n ? `${task.evidence.n} recorded run${task.evidence.n === 1 ? '' : 's'}` : 'No live evidence'}</span><strong>${task.evidence.all_arms_observed ? '3 arms observed' : task.evidence.n ? 'partial cell' : 'candidate'}</strong></div></button>`).join('') : $('#empty-template').innerHTML;
}
function renderRunQueue(records) {
  const queue = filteredRecords(records).slice(0, 24); $('#queue-count').textContent = `${queue.length} matching`;
  $('#run-queue').innerHTML = queue.length ? queue.map((record) => { const [label, className] = outcome(record); const selected = record.run_id === state.selectedRunId; return `<button type="button" class="run-item ${selected ? 'selected' : ''}" role="option" aria-selected="${selected}" data-run-id="${escapeHtml(record.run_id)}"><span class="run-item-top"><strong>${escapeHtml(record.application_id)} / ${escapeHtml(record.task_id)}</strong><span class="outcome ${className}">${escapeHtml(label)}</span></span><span><span class="arm-label arm-${escapeHtml(record.arm)}">${escapeHtml(record.arm)}</span> · ${formatMs(record.wall_time_ms)} · ${record.replay?.available ? `${record.replay.frame_count} frames` : 'no frames'}</span></button>`; }).join('') : '<div class="empty compact">No readable run records match these filters.</div>';
}
function renderLedger(records) {
  const visible = filteredRecords(records);
  $('#ledger-body').innerHTML = visible.length ? visible.map((record) => { const [label, className] = outcome(record); return `<tr class="ledger-row" tabindex="0" data-run-id="${escapeHtml(record.run_id)}"><td class="task-cell"><strong>${escapeHtml(record.application_id)} / ${escapeHtml(record.task_id)}</strong><small>${escapeHtml(record.condition)}${record.randomization_block ? ` · ${shortId(record.randomization_block, 18)}` : ''}</small></td><td><span class="arm-label arm-${escapeHtml(record.arm)}">${escapeHtml(record.arm)}</span></td><td><span class="outcome ${className}">${escapeHtml(label)}</span></td><td>${formatMs(record.wall_time_ms)} <span class="muted">/ ${record.actions ?? '—'} acts</span></td><td class="muted">${record.replay?.available ? `${record.replay.frame_count} local frames` : escapeHtml(record.configuration_id ?? record.schema_version ?? 'legacy')}</td></tr>`; }).join('') : '<tr><td colspan="5">No readable run records match these filters.</td></tr>';
}
function percent(value) { return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(value >= .995 ? 0 : 1)}%`; }
function compactNumber(value) { return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : '—'; }
function armsForFailure(item) { return Object.entries(item.by_arm ?? {}).filter(([, count]) => count > 0).map(([arm, count]) => `${arm} ${count}`).join(' · ') || 'unattributed'; }
function renderAnalysis(analysis) {
  if (!analysis) return;
  const target = analysis.target;
  const summary = analysis.summary ?? {};
  $('#analysis-status').textContent = target ? `${compactNumber(summary.observed_runs ?? 0)} observed` : 'NO TARGET';
  $('#scale-summary').innerHTML = target ? `<div><strong>${compactNumber(target.observed_execution_units)}</strong><span>observed executions</span></div><div><strong>${compactNumber(target.execution_units)}</strong><span>target executions</span></div><div><strong>${compactNumber(summary.complete_three_arm_blocks ?? 0)}</strong><span>complete matched blocks</span></div><div><strong>${compactNumber(target.matched_cells)}</strong><span>target matched cells</span></div>` : '<div><strong>—</strong><span>expansion target unavailable</span></div>';
  const fraction = Math.max(0, Math.min(1, target?.observed_cell_fraction ?? 0));
  $('#scale-track-fill').style.width = `${fraction * 100}%`;
  $('#scale-note').textContent = target ? `${percent(target.observed_cell_fraction)} of planned execution units are represented. Applications: ${compactNumber(summary.declared_applications ?? 0)}/${compactNumber(summary.target_applications ?? 0)} declared, ${compactNumber(summary.admitted_applications ?? 0)} admitted; workflow slots: ${compactNumber(summary.admitted_workflow_slots ?? 0)}/${compactNumber(summary.target_workflow_slots ?? 0)} admitted. This is descriptive coverage, not confirmatory completion.` : analysis.evidence_boundary;
  $('#arm-cards').innerHTML = (analysis.strategy_comparison ?? []).map((item) => `<div class="arm-card arm-${escapeHtml(item.arm)}"><div class="arm-card-top"><strong>${escapeHtml(item.arm)}</strong><span>${compactNumber(item.n)} runs</span></div><div class="arm-rate">${percent(item.strict_pass_rate)}</div><small>strict pass · median ${formatMs(item.median_wall_time_ms)} · ${item.mean_actions === null ? '—' : item.mean_actions.toFixed(1)} mean actions</small><div class="mini-track"><span style="width:${Math.max(0, Math.min(100, (item.strict_pass_rate ?? 0) * 100))}%"></span></div></div>`).join('');
  $('#condition-body').innerHTML = (analysis.condition_comparison ?? []).map((item) => `<tr><td>${escapeHtml(item.condition)}</td><td><span class="arm-label arm-${escapeHtml(item.arm)}">${escapeHtml(item.arm)}</span></td><td>${compactNumber(item.n)}</td><td>${percent(item.strict_pass_rate)}</td><td>${formatMs(item.median_wall_time_ms)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No condition-level records yet.</td></tr>';
  $('#strata-body').innerHTML = (analysis.provider_model_comparison ?? []).map((item) => `<tr><td>${escapeHtml(item.provider_id)}</td><td>${escapeHtml(item.model_id)}</td><td><span class="arm-label arm-${escapeHtml(item.arm)}">${escapeHtml(item.arm)}</span></td><td>${compactNumber(item.n)}</td><td>${percent(item.strict_pass_rate)}</td><td>${formatMs(item.median_wall_time_ms)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No provider/model strata yet.</td></tr>';
  const maxFailure = Math.max(1, ...(analysis.failure_taxonomy ?? []).map((item) => item.count));
  $('#failure-bars').innerHTML = (analysis.failure_taxonomy ?? []).slice(0, 10).map((item) => `<div class="failure-row"><div><strong>${escapeHtml(item.failure_category)}</strong><span>${compactNumber(item.count)}</span></div><div class="failure-track"><span style="width:${(item.count / maxFailure) * 100}%"></span></div><small>${escapeHtml(armsForFailure(item))}</small></div>`).join('') || '<div class="empty compact">No classified failures yet.</div>';
  $('#coverage-body').innerHTML = (analysis.application_comparison ?? []).map((item) => `<tr><td><strong>${escapeHtml(item.application_id)}</strong></td><td><span class="tag">${escapeHtml(item.application_status)}</span></td><td>${compactNumber(item.observed_workflows)} observed · ${compactNumber(item.ready_workflows)} admitted / ${compactNumber(item.target_workflows ?? item.declared_workflows)} target</td>${item.arms.map((arm) => `<td><span class="coverage-rate">${percent(arm.strict_pass_rate)}</span><small>${compactNumber(arm.n)} runs</small></td>`).join('')}</tr>`).join('') || '<tr><td colspan="6" class="muted">No application records yet.</td></tr>';
}
function renderDossier(detail) {
  const record = detail.record; const [label, className] = outcome(record); $('#run-outcome').textContent = label; $('#run-outcome').className = `outcome ${className}`;
  const profile = record.optimization_profile ?? 'not recorded';
  const provider = record.provider_id ?? (record.arm === 'playwright' ? 'scripted' : 'unknown-provider');
  const model = record.model_id ?? (record.arm === 'playwright' ? 'deterministic' : 'unknown-model');
  $('#run-dossier').innerHTML = `<dl><div><dt>RUN ID</dt><dd>${escapeHtml(record.run_id)}</dd></div><div><dt>ARM / CONTRACT</dt><dd><span class="arm-label arm-${escapeHtml(record.arm)}">${escapeHtml(record.arm)}</span> · ${escapeHtml(record.observation_contract ?? 'legacy')}</dd></div><div><dt>PROVIDER / MODEL</dt><dd>${escapeHtml(provider)} / ${escapeHtml(model)}</dd></div><div><dt>PROFILE / ACTION MODE</dt><dd>${escapeHtml(profile)}${record.hybrid_action_mode ? ` · ${escapeHtml(record.hybrid_action_mode)}` : ''} · ${record.retries ?? 0} retries · ${record.actions ?? '—'} actions</dd></div><div><dt>STATE / VERDICT</dt><dd>${record.checkpoint_reached ? 'checkpoint reached' : 'checkpoint not reached'} · ${escapeHtml(record.emitted_verdict ?? '—')}</dd></div><div><dt>FAILURE BOUNDARY</dt><dd>${escapeHtml(record.failure_category ?? 'none')}</dd></div><div><dt>LOCAL ARCHIVE</dt><dd>${detail.replay.available ? `${detail.replay.frames.length} frames · ${detail.replay.provider_events.length} provider summaries · screenshot digests retained` : 'not retained'}</dd></div></dl>`;
  const events = detail.replay.frames.length ? detail.replay.frames : record.trajectory;
  $('#trajectory-list').innerHTML = events.length ? events.map((event, index) => { const item = `<span class="trace-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(event.phase ?? `step ${event.step ?? index}`)}</strong><small>${escapeHtml(event.action ? actionLabel(event.action) : 'observation captured')}${stateLabel(event.state) ? ` · ${escapeHtml(stateLabel(event.state))}` : ''}</small>${event.url ? `<small class="trace-url">${escapeHtml(event.url)}</small>` : ''}${event.screenshot_digest ? `<small class="trace-url">sha256 ${escapeHtml(event.screenshot_digest.slice(0, 16))}…${event.provider_event_ids?.length ? ` · ${event.provider_event_ids.length} provider event` : ''}</small>` : ''}</span>`; return event.image_url ? `<li><button type="button" class="trace-step ${index === state.frameIndex ? 'active' : ''}" data-frame-index="${index}">${item}</button></li>` : `<li><div class="trace-step">${item}</div></li>`; }).join('') : '<li class="trajectory-empty">No action-level trajectory was retained for this historical record.</li>';
}
function renderFrame(detail) {
  const frames = detail.replay.frames; const image = $('#replay-image'); const empty = $('#frame-empty'); const previous = $('#frame-prev'); const next = $('#frame-next');
  if (!frames.length) { image.hidden = true; image.removeAttribute('src'); empty.hidden = false; $('#frame-index').textContent = 'NO ARCHIVE'; $('#frame-caption').textContent = detail.replay.note; $('#frame-strip').innerHTML = ''; previous.disabled = true; next.disabled = true; return; }
  state.frameIndex = Math.min(Math.max(state.frameIndex, 0), frames.length - 1); const frame = frames[state.frameIndex]; image.src = frame.image_url; image.hidden = false; empty.hidden = true;
  $('#frame-label').textContent = `${frame.phase.toUpperCase()} FRAME`; $('#frame-index').textContent = `${String(state.frameIndex + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`; $('#frame-caption').textContent = `step ${frame.step ?? '—'} · ${frame.action ? actionLabel(frame.action) : 'agent observation'} · ${frame.url ?? 'local page'}${stateLabel(frame.state) ? ` · ${stateLabel(frame.state)}` : ''}${frame.screenshot_digest ? ` · sha256 ${frame.screenshot_digest.slice(0, 16)}…` : ''}`; previous.disabled = state.frameIndex === 0; next.disabled = state.frameIndex === frames.length - 1;
  $('#frame-strip').innerHTML = frames.map((item, index) => `<button type="button" class="frame-thumb ${index === state.frameIndex ? 'active' : ''}" data-frame-index="${index}" aria-label="Open frame ${index + 1}"><img src="${item.image_url}" alt="Frame ${index + 1}" loading="lazy"><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(item.phase ?? 'frame')}</span></button>`).join('');
}
function renderSelectedRun() { if (!state.runDetail) return; renderFrame(state.runDetail); renderDossier(state.runDetail); if (state.data) { renderReplayFilters(state.data.recent_records); renderArmComparison(state.data.recent_records); renderRunQueue(state.data.recent_records); renderLedger(state.data.recent_records); } }
async function selectRun(runId) {
  if (!runId) return; state.selectedRunId = runId; state.frameIndex = 0; $('#run-dossier').textContent = 'Loading local replay…';
  const compact = state.data?.recent_records?.find((record) => record.run_id === runId);
  if (compact) { state.application = compact.application_id; state.task = recordKey(compact); state.condition = compact.condition; state.selectedBlock = compact.randomization_block ?? null; }
  try { const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' }); if (!response.ok) throw new Error('run detail unavailable'); state.runDetail = await response.json(); } catch (error) { state.runDetail = null; $('#run-dossier').textContent = `Unable to load run detail: ${error.message}`; }
  renderSelectedRun();
}
function render(data) {
  state.data = data; $('#boundary-copy').textContent = data.evidence_boundary; $('#record-count').textContent = data.ledger.record_count; $('#strict-passes').textContent = data.ledger.strict_passes; $('#checkpoint-only').textContent = data.ledger.checkpoint_only; renderLiveRun(data);
  renderAnalysis(data.analysis); renderSuts(data.suts); renderReplayFilters(data.recent_records); renderTasks(data.tasks); renderArmComparison(data.recent_records); renderRunQueue(data.recent_records); renderLedger(data.recent_records); const selectedStillPresent = data.recent_records.some((record) => record.run_id === state.selectedRunId); if (!selectedStillPresent && data.recent_records[0]) selectRun(data.recent_records[0].run_id);
}
document.addEventListener('click', (event) => { const taskTarget = event.target.closest('[data-task-key]'); if (taskTarget && state.data) { state.task = taskTarget.dataset.taskKey; state.application = taskTarget.dataset.taskKey.split('/')[0]; state.condition = 'all'; state.selectedBlock = null; renderReplayFilters(state.data.recent_records); renderTasks(state.data.tasks); renderArmComparison(state.data.recent_records); renderRunQueue(state.data.recent_records); renderLedger(state.data.recent_records); const first = filteredRecords(state.data.recent_records)[0]; if (first) selectRun(first.run_id); document.querySelector('.replay-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } const runTarget = event.target.closest('[data-run-id]'); if (runTarget) selectRun(runTarget.dataset.runId); const frameTarget = event.target.closest('[data-frame-index]'); if (frameTarget && state.runDetail) { state.frameIndex = Number(frameTarget.dataset.frameIndex); renderSelectedRun(); } });
document.addEventListener('keydown', (event) => { const row = event.target.closest('.ledger-row'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectRun(row.dataset.runId); } });
$('#frame-prev').addEventListener('click', () => { if (state.runDetail && state.frameIndex > 0) { state.frameIndex -= 1; renderSelectedRun(); } });
$('#frame-next').addEventListener('click', () => { if (state.runDetail && state.frameIndex < state.runDetail.replay.frames.length - 1) { state.frameIndex += 1; renderSelectedRun(); } });
for (const [selector, key] of [['#replay-application', 'application'], ['#replay-task', 'task'], ['#replay-condition', 'condition']]) $(selector).addEventListener('change', (event) => { state[key] = event.target.value; if (key === 'application' && state.task !== 'all' && !state.task.startsWith(`${state.application}/`)) state.task = 'all'; state.selectedBlock = null; if (state.data) { renderReplayFilters(state.data.recent_records); renderTasks(state.data.tasks); renderArmComparison(state.data.recent_records); renderRunQueue(state.data.recent_records); renderLedger(state.data.recent_records); const first = filteredRecords(state.data.recent_records)[0]; if (first) selectRun(first.run_id); } });
$('#replay-clear').addEventListener('click', () => { state.application = 'all'; state.task = 'all'; state.condition = 'all'; state.selectedBlock = null; if (state.data) { renderReplayFilters(state.data.recent_records); renderTasks(state.data.tasks); renderArmComparison(state.data.recent_records); renderRunQueue(state.data.recent_records); renderLedger(state.data.recent_records); } });
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); if (state.data) renderTasks(state.data.tasks); });
const connection = $('#connection');
try { const events = new EventSource('/api/events'); events.addEventListener('overview', (event) => { render(JSON.parse(event.data)); connection.textContent = 'LIVE'; connection.classList.remove('offline'); }); events.onerror = () => { connection.textContent = 'RECONNECTING'; connection.classList.add('offline'); }; } catch { connection.textContent = 'POLLING'; refresh().catch(() => { connection.textContent = 'OFFLINE'; connection.classList.add('offline'); }); setInterval(() => refresh().catch(() => {}), 3000); }
async function refresh() { const response = await fetch('/api/overview', { cache: 'no-store' }); if (!response.ok) throw new Error('overview unavailable'); render(await response.json()); }
