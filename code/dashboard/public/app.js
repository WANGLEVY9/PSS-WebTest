const state = { filter: 'all', data: null, selectedRunId: null, runDetail: null, frameIndex: 0 };
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

function renderSuts(suts) {
  $('#sut-count').textContent = `${suts.filter((sut) => sut.reachable).length}/${suts.length}`;
  $('#sut-grid').innerHTML = suts.map((sut) => `<article class="sut"><div class="sut-header"><h3>${escapeHtml(sut.name)}</h3><span class="tag ${sut.reachable ? 'ok' : 'down'}">${sut.reachable ? 'REACHABLE' : 'OFFLINE'}</span></div><p>${escapeHtml(sut.url.replace(/^https?:\/\//, ''))} · ${sut.http_status ?? sut.error ?? '—'} · ${formatMs(sut.latency_ms)}</p></article>`).join('');
}
function taskClass(task) { if (!task.evidence.n) return ''; return task.evidence.all_arms_observed ? 'observed' : 'partial'; }
function renderTasks(tasks) {
  const visible = tasks.filter((task) => state.filter === 'all' || (state.filter === 'observed' ? task.evidence.n > 0 : task.status === 'candidate'));
  $('#task-grid').innerHTML = visible.length ? visible.map((task) => `<article class="task ${taskClass(task)}"><div class="task-top"><span class="tag">${escapeHtml(task.application_id.toUpperCase())}</span><span class="tag">${escapeHtml(task.status.toUpperCase())}</span></div><h3>${escapeHtml(task.id)}</h3><div class="task-meta"><span class="pill">${escapeHtml(task.complexity)}</span><span class="pill">${escapeHtml(task.oracle_authority)}</span></div><div class="task-footer"><span>${task.evidence.n ? `${task.evidence.n} recorded run${task.evidence.n === 1 ? '' : 's'}` : 'No live evidence'}</span><strong>${task.evidence.all_arms_observed ? '3 arms observed' : task.evidence.n ? 'partial cell' : 'candidate'}</strong></div></article>`).join('') : $('#empty-template').innerHTML;
}
function renderRunQueue(records) {
  const queue = records.slice(0, 18); $('#queue-count').textContent = `${queue.length} latest`;
  $('#run-queue').innerHTML = queue.length ? queue.map((record) => { const [label, className] = outcome(record); const selected = record.run_id === state.selectedRunId; return `<button type="button" class="run-item ${selected ? 'selected' : ''}" role="option" aria-selected="${selected}" data-run-id="${escapeHtml(record.run_id)}"><span class="run-item-top"><strong>${escapeHtml(record.task_id)}</strong><span class="outcome ${className}">${escapeHtml(label)}</span></span><span>${escapeHtml(record.arm)} · ${formatMs(record.wall_time_ms)} · ${record.replay?.available ? `${record.replay.frame_count} frames` : 'no frames'}</span></button>`; }).join('') : '<div class="empty compact">No readable run records yet.</div>';
}
function renderLedger(records) {
  $('#ledger-body').innerHTML = records.length ? records.map((record) => { const [label, className] = outcome(record); return `<tr class="ledger-row" tabindex="0" data-run-id="${escapeHtml(record.run_id)}"><td class="task-cell"><strong>${escapeHtml(record.task_id)}</strong><small>${escapeHtml(record.condition)}</small></td><td>${escapeHtml(record.arm)}</td><td><span class="outcome ${className}">${escapeHtml(label)}</span></td><td>${formatMs(record.wall_time_ms)} <span class="muted">/ ${record.actions ?? '—'} acts</span></td><td class="muted">${record.replay?.available ? `${record.replay.frame_count} local frames` : escapeHtml(record.configuration_id ?? record.schema_version ?? 'legacy')}</td></tr>`; }).join('') : '<tr><td colspan="5">No readable run records yet.</td></tr>';
}
function renderDossier(detail) {
  const record = detail.record; const [label, className] = outcome(record); $('#run-outcome').textContent = label; $('#run-outcome').className = `outcome ${className}`;
  $('#run-dossier').innerHTML = `<dl><div><dt>RUN ID</dt><dd>${escapeHtml(record.run_id)}</dd></div><div><dt>ARM / CONTRACT</dt><dd>${escapeHtml(record.arm)} · ${escapeHtml(record.observation_contract ?? 'legacy')}</dd></div><div><dt>STATE / VERDICT</dt><dd>${record.checkpoint_reached ? 'checkpoint reached' : 'checkpoint not reached'} · ${escapeHtml(record.emitted_verdict ?? '—')}</dd></div><div><dt>FAILURE BOUNDARY</dt><dd>${escapeHtml(record.failure_category ?? 'none')}</dd></div><div><dt>LOCAL ARCHIVE</dt><dd>${detail.replay.available ? `${detail.replay.frames.length} frames · ${detail.replay.provider_events.length} provider summaries · screenshot digests retained` : 'not retained'}</dd></div></dl>`;
  const events = detail.replay.frames.length ? detail.replay.frames : record.trajectory;
  $('#trajectory-list').innerHTML = events.length ? events.map((event, index) => { const item = `<span class="trace-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(event.phase ?? `step ${event.step ?? index}`)}</strong><small>${escapeHtml(event.action ? actionLabel(event.action) : 'observation captured')}${stateLabel(event.state) ? ` · ${escapeHtml(stateLabel(event.state))}` : ''}</small>${event.url ? `<small class="trace-url">${escapeHtml(event.url)}</small>` : ''}${event.screenshot_digest ? `<small class="trace-url">sha256 ${escapeHtml(event.screenshot_digest.slice(0, 16))}…${event.provider_event_ids?.length ? ` · ${event.provider_event_ids.length} provider event` : ''}</small>` : ''}</span>`; return event.image_url ? `<li><button type="button" class="trace-step ${index === state.frameIndex ? 'active' : ''}" data-frame-index="${index}">${item}</button></li>` : `<li><div class="trace-step">${item}</div></li>`; }).join('') : '<li class="trajectory-empty">No action-level trajectory was retained for this historical record.</li>';
}
function renderFrame(detail) {
  const frames = detail.replay.frames; const image = $('#replay-image'); const empty = $('#frame-empty'); const previous = $('#frame-prev'); const next = $('#frame-next');
  if (!frames.length) { image.hidden = true; image.removeAttribute('src'); empty.hidden = false; $('#frame-index').textContent = 'NO ARCHIVE'; $('#frame-caption').textContent = detail.replay.note; previous.disabled = true; next.disabled = true; return; }
  state.frameIndex = Math.min(Math.max(state.frameIndex, 0), frames.length - 1); const frame = frames[state.frameIndex]; image.src = frame.image_url; image.hidden = false; empty.hidden = true;
  $('#frame-label').textContent = `${frame.phase.toUpperCase()} FRAME`; $('#frame-index').textContent = `${String(state.frameIndex + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`; $('#frame-caption').textContent = `step ${frame.step ?? '—'} · ${frame.action ? actionLabel(frame.action) : 'agent observation'} · ${frame.url ?? 'local page'}${stateLabel(frame.state) ? ` · ${stateLabel(frame.state)}` : ''}${frame.screenshot_digest ? ` · sha256 ${frame.screenshot_digest.slice(0, 16)}…` : ''}`; previous.disabled = state.frameIndex === 0; next.disabled = state.frameIndex === frames.length - 1;
}
function renderSelectedRun() { if (!state.runDetail) return; renderFrame(state.runDetail); renderDossier(state.runDetail); if (state.data) { renderRunQueue(state.data.recent_records); renderLedger(state.data.recent_records); } }
async function selectRun(runId) {
  if (!runId) return; state.selectedRunId = runId; state.frameIndex = 0; $('#run-dossier').textContent = 'Loading local replay…';
  try { const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' }); if (!response.ok) throw new Error('run detail unavailable'); state.runDetail = await response.json(); } catch (error) { state.runDetail = null; $('#run-dossier').textContent = `Unable to load run detail: ${error.message}`; }
  renderSelectedRun();
}
function render(data) {
  state.data = data; $('#boundary-copy').textContent = data.evidence_boundary; $('#record-count').textContent = data.ledger.record_count; $('#strict-passes').textContent = data.ledger.strict_passes; $('#checkpoint-only').textContent = data.ledger.checkpoint_only; $('#updated').textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(data.generated_at));
  renderSuts(data.suts); renderTasks(data.tasks); renderRunQueue(data.recent_records); renderLedger(data.recent_records); const selectedStillPresent = data.recent_records.some((record) => record.run_id === state.selectedRunId); if (!selectedStillPresent && data.recent_records[0]) selectRun(data.recent_records[0].run_id);
}
document.addEventListener('click', (event) => { const runTarget = event.target.closest('[data-run-id]'); if (runTarget) selectRun(runTarget.dataset.runId); const frameTarget = event.target.closest('[data-frame-index]'); if (frameTarget && state.runDetail) { state.frameIndex = Number(frameTarget.dataset.frameIndex); renderSelectedRun(); } });
document.addEventListener('keydown', (event) => { const row = event.target.closest('.ledger-row'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectRun(row.dataset.runId); } });
$('#frame-prev').addEventListener('click', () => { if (state.runDetail && state.frameIndex > 0) { state.frameIndex -= 1; renderSelectedRun(); } });
$('#frame-next').addEventListener('click', () => { if (state.runDetail && state.frameIndex < state.runDetail.replay.frames.length - 1) { state.frameIndex += 1; renderSelectedRun(); } });
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); if (state.data) renderTasks(state.data.tasks); });
const connection = $('#connection');
try { const events = new EventSource('/api/events'); events.addEventListener('overview', (event) => { render(JSON.parse(event.data)); connection.textContent = 'LIVE'; connection.classList.remove('offline'); }); events.onerror = () => { connection.textContent = 'RECONNECTING'; connection.classList.add('offline'); }; } catch { connection.textContent = 'POLLING'; refresh().catch(() => { connection.textContent = 'OFFLINE'; connection.classList.add('offline'); }); setInterval(() => refresh().catch(() => {}), 3000); }
async function refresh() { const response = await fetch('/api/overview', { cache: 'no-store' }); if (!response.ok) throw new Error('overview unavailable'); render(await response.json()); }
