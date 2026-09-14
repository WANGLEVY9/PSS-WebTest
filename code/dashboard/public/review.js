const state = { mode: localStorage.getItem('pss-screening-mode') || 'reviewer-1', data: null, selected: null, query: '', benchmark: 'all' };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const keyOf = (candidate) => [candidate.benchmark_id, candidate.source_commit, candidate.task_source_id, candidate.instruction_digest].join('|');
const criteria = () => state.data?.criteria ?? [];
function visibleCandidates() {
  const query = state.query.trim().toLowerCase();
  return (state.data?.candidates ?? []).filter((candidate) => (state.benchmark === 'all' || candidate.benchmark_id === state.benchmark) && (!query || [candidate.benchmark_id, candidate.task_source_id, ...(candidate.sites ?? [])].join(' ').toLowerCase().includes(query)));
}
function renderProgress(progress) {
  const response = state.data?.progress ?? progress?.[state.mode];
  const cards = Object.entries(progress ?? {}).map(([reviewer, item]) => `<div class="progress-row"><div class="progress-row-head"><span>${reviewer.replace('-', ' ').toUpperCase()}</span><strong>${item.completed}/${item.total}</strong></div><div class="progress-track"><span style="width:${Math.min(100, item.fraction * 100)}%"></span></div></div>`).join('');
  $('#progress-cards').innerHTML = cards || '<p class="guard-copy">No review state yet.</p>';
  $('#sample-count').textContent = state.data?.candidates?.length ?? '—';
  $('#workspace-status').textContent = response ? `${response.completed}/${response.total} SAVED` : 'READY';
}
function renderQueue() {
  const candidates = visibleCandidates(); $('#queue-count').textContent = `${candidates.length} shown`;
  $('#queue').innerHTML = candidates.map((candidate) => {
    const key = keyOf(candidate); const done = criteria().filter((item) => state.data.decisions?.[`${key}::${item.code}`]).length;
    return `<button type="button" class="queue-item ${done === criteria().length ? 'complete' : done ? 'partial' : ''} ${state.selected === key ? 'selected' : ''}" data-candidate="${escapeHtml(key)}"><strong>${escapeHtml(candidate.task_source_id)}</strong><small>${escapeHtml(candidate.benchmark_id)} · ${done}/${criteria().length} criteria</small></button>`;
  }).join('') || '<div class="empty">No tasks match this filter.</div>';
}
function renderBrief(candidate) {
  if (!candidate) { $('#task-title').textContent = 'Select a task'; $('#task-meta').textContent = 'Choose a row from the outcome-blind queue to begin.'; $('#source-file').textContent = '—'; $('#instruction-digest').textContent = '—'; $('#task-tags').innerHTML = ''; return; }
  $('#task-title').textContent = candidate.task_source_id;
  $('#task-meta').textContent = 'Review only the pinned official source. Agent runs, evaluator internals, and prior outcomes are intentionally unavailable in this workspace.';
  $('#source-file').textContent = candidate.source_file ?? '—'; $('#instruction-digest').textContent = candidate.instruction_digest;
  $('#task-tags').innerHTML = [candidate.benchmark_id, ...(candidate.sites ?? []), candidate.require_login === true ? 'login required' : 'login unspecified'].map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
}
function renderCriteria(candidate) {
  if (!candidate || state.mode === 'adjudicator') { $('#criteria').innerHTML = ''; return; }
  const key = keyOf(candidate); const decisions = state.data.decisions ?? {};
  $('#criteria').innerHTML = criteria().map((item) => {
    const saved = decisions[`${key}::${item.code}`] ?? {}; const decision = saved.decision ?? '';
    return `<article class="criterion panel" data-criterion="${item.code}"><div class="criterion-head"><div class="criterion-title"><span class="criterion-code">${item.code}</span><strong>${escapeHtml(item.label)}</strong></div><span class="blind-pill">SOURCE ONLY</span></div><p class="criterion-help">Record yes/no/unclear only when supported by a citation from the pinned release or official environment documentation.</p><div class="decision-group">${['yes','no','unclear'].map((value) => `<button type="button" class="decision ${decision === value ? `selected-${value}` : ''}" data-decision="${value}">${value}</button>`).join('')}</div><div class="criterion-fields"><input data-field="evidence_reference" value="${escapeHtml(saved.evidence_reference ?? '')}" placeholder="Evidence reference (file/section/URL)" /><textarea data-field="notes" placeholder="Short rationale; unclear is acceptable">${escapeHtml(saved.notes ?? '')}</textarea></div><div class="save-line"><span class="save-state">${saved.timestamp ? `saved ${new Date(saved.timestamp).toLocaleString()}` : 'not saved'}</span><button type="button" class="save-button" data-save="${item.code}" disabled>Save decision</button></div></article>`;
  }).join('');
}
async function loadReviewer() {
  if (state.mode === 'adjudicator') { const response = await fetch('/api/screening/conflicts?role=adjudicator'); const payload = await response.json(); state.data = { candidates: [], criteria: [], decisions: {}, progress: null }; renderProgress(await fetch('/api/screening/progress').then((r) => r.json()).then((p) => p.reviewers)); renderConflicts(payload.conflicts ?? []); return; }
  const response = await fetch(`/api/screening/review?reviewer=${encodeURIComponent(state.mode)}`); if (!response.ok) throw new Error('review workspace unavailable'); state.data = await response.json(); const progress = await fetch('/api/screening/progress').then((r) => r.json()); state.data.progress = progress.reviewers[state.mode]; renderProgress(progress.reviewers); const benchmarks = [...new Set(state.data.candidates.map((candidate) => candidate.benchmark_id))].sort(); $('#benchmark').innerHTML = `<option value="all">All benchmarks</option>${benchmarks.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`; $('#benchmark').value = state.benchmark; if (!state.selected || !state.data.candidates.some((candidate) => keyOf(candidate) === state.selected)) state.selected = state.data.candidates[0] ? keyOf(state.data.candidates[0]) : null; renderQueue(); const candidate = state.data.candidates.find((item) => keyOf(item) === state.selected); renderBrief(candidate); renderCriteria(candidate);
}
function renderConflicts(conflicts) { $('#adjudication').hidden = false; $('#conflict-count').textContent = `${conflicts.length} conflicts`; $('#conflicts').innerHTML = conflicts.length ? conflicts.slice(0, 200).map((item) => `<div class="conflict-card"><strong>${escapeHtml(item.key.split('|').slice(-2).join(' / '))} · ${item.criterion}</strong><small>Reviewer 1: ${item.reviewer_1} · Reviewer 2: ${item.reviewer_2}</small><div class="adjudicate-row"><button data-adjudicate="yes" data-key="${escapeHtml(item.key)}" data-criterion="${item.criterion}">Adjudicate yes</button><button data-adjudicate="no" data-key="${escapeHtml(item.key)}" data-criterion="${item.criterion}">Adjudicate no</button><button data-adjudicate="unclear" data-key="${escapeHtml(item.key)}" data-criterion="${item.criterion}">Adjudicate unclear</button></div></div>`).join('') : '<p class="guard-copy">No disagreement is currently available. Both independent decisions must exist before adjudication can start.</p>'; }
$('#mode').value = state.mode; $('#mode').addEventListener('change', async (event) => { state.mode = event.target.value; localStorage.setItem('pss-screening-mode', state.mode); $('#adjudication').hidden = state.mode !== 'adjudicator'; await loadReviewer(); });
$('#search').addEventListener('input', (event) => { state.query = event.target.value; renderQueue(); }); $('#benchmark').addEventListener('change', (event) => { state.benchmark = event.target.value; renderQueue(); });
document.addEventListener('click', async (event) => {
  const candidateButton = event.target.closest('[data-candidate]'); if (candidateButton && state.data && state.mode !== 'adjudicator') { state.selected = candidateButton.dataset.candidate; renderQueue(); const candidate = state.data.candidates.find((item) => keyOf(item) === state.selected); renderBrief(candidate); renderCriteria(candidate); }
  const decisionButton = event.target.closest('[data-decision]'); if (decisionButton) { const card = decisionButton.closest('.criterion'); card.dataset.selectedDecision = decisionButton.dataset.decision; card.querySelectorAll('.decision').forEach((button) => button.classList.toggle(`selected-${button.dataset.decision}`, button === decisionButton)); card.querySelector('[data-save]').disabled = false; }
  const saveButton = event.target.closest('[data-save]'); if (saveButton) { const card = saveButton.closest('.criterion'); const payload = { reviewer: state.mode, key: state.selected, criterion: saveButton.dataset.save, decision: card.dataset.selectedDecision, evidence_reference: card.querySelector('[data-field="evidence_reference"]').value, notes: card.querySelector('[data-field="notes"]').value }; saveButton.disabled = true; const response = await fetch('/api/screening/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); card.querySelector('.save-state').textContent = result.ok ? `saved ${new Date().toLocaleString()}` : result.error; if (result.ok) await loadReviewer(); }
  const adjudicate = event.target.closest('[data-adjudicate]'); if (adjudicate) { const response = await fetch('/api/screening/adjudicate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: adjudicate.dataset.key, criterion: adjudicate.dataset.criterion, decision: adjudicate.dataset.adjudicate }) }); const result = await response.json(); if (!result.ok) alert(result.error); else await loadReviewer(); }
});
loadReviewer().catch((error) => { $('#workspace-status').textContent = 'OFFLINE'; $('#queue').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; });
