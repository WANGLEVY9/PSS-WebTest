const state = { filter: 'all', data: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatMs = (value) => value === null || value === undefined ? '—' : value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}s` : `${value}ms`;

function renderSuts(suts) {
  $('#sut-count').textContent = `${suts.filter((sut) => sut.reachable).length}/${suts.length}`;
  $('#sut-grid').innerHTML = suts.map((sut) => `<article class="sut"><div class="sut-header"><h3>${escapeHtml(sut.name)}</h3><span class="tag ${sut.reachable ? 'ok' : 'down'}">${sut.reachable ? 'REACHABLE' : 'OFFLINE'}</span></div><p>${escapeHtml(sut.url.replace(/^https?:\/\//, ''))} · ${sut.http_status ?? sut.error ?? '—'} · ${formatMs(sut.latency_ms)}</p></article>`).join('');
}

function taskClass(task) { if (!task.evidence.n) return ''; return task.evidence.all_arms_observed ? 'observed' : 'partial'; }
function renderTasks(tasks) {
  const visible = tasks.filter((task) => state.filter === 'all' || (state.filter === 'observed' ? task.evidence.n > 0 : task.status === 'candidate'));
  $('#task-grid').innerHTML = visible.length ? visible.map((task) => `<article class="task ${taskClass(task)}"><div class="task-top"><span class="tag">${escapeHtml(task.application_id.toUpperCase())}</span><span class="tag">${escapeHtml(task.status.toUpperCase())}</span></div><h3>${escapeHtml(task.id)}</h3><div class="task-meta"><span class="pill">${escapeHtml(task.complexity)}</span><span class="pill">${escapeHtml(task.oracle_authority)}</span></div><div class="task-footer"><span>${task.evidence.n ? `${task.evidence.n} recorded run${task.evidence.n === 1 ? '' : 's'}` : 'No live evidence'}</span><strong>${task.evidence.all_arms_observed ? '3 arms observed' : task.evidence.n ? 'partial cell' : 'candidate'}</strong></div></article>`).join('') : $('#empty-template').innerHTML;
}

function outcome(record) {
  if (record.status === 'completed' && record.checkpoint_reached && record.emitted_verdict === record.ground_truth_verdict) return ['STRICT PASS', 'pass'];
  if (record.checkpoint_reached) return ['CHECKPOINT ONLY', 'partial'];
  return [record.failure_category ?? record.status ?? 'FAILED', 'fail'];
}
function renderLedger(records) {
  $('#ledger-body').innerHTML = records.length ? records.map((record) => { const [label, className] = outcome(record); return `<tr><td class="task-cell"><strong>${escapeHtml(record.task_id)}</strong><small>${escapeHtml(record.condition)}</small></td><td>${escapeHtml(record.arm)}</td><td><span class="outcome ${className}">${escapeHtml(label)}</span></td><td>${formatMs(record.wall_time_ms)} <span class="muted">/ ${record.actions ?? '—'} acts</span></td><td class="muted">${escapeHtml(record.configuration_id ?? record.schema_version ?? 'legacy')}</td></tr>`; }).join('') : `<tr><td colspan="5">No readable run records yet.</td></tr>`;
}

function render(data) {
  state.data = data;
  $('#boundary-copy').textContent = data.evidence_boundary;
  $('#record-count').textContent = data.ledger.record_count;
  $('#strict-passes').textContent = data.ledger.strict_passes;
  $('#checkpoint-only').textContent = data.ledger.checkpoint_only;
  $('#updated').textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(data.generated_at));
  renderSuts(data.suts); renderTasks(data.tasks); renderLedger(data.recent_records);
}

async function refresh() { const response = await fetch('/api/overview', { cache: 'no-store' }); if (!response.ok) throw new Error('overview unavailable'); render(await response.json()); }
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); if (state.data) renderTasks(state.data.tasks); });

const connection = $('#connection');
try {
  const events = new EventSource('/api/events');
  events.addEventListener('overview', (event) => { render(JSON.parse(event.data)); connection.textContent = 'LIVE'; connection.classList.remove('offline'); });
  events.onerror = () => { connection.textContent = 'RECONNECTING'; connection.classList.add('offline'); };
} catch { connection.textContent = 'POLLING'; refresh().catch(() => { connection.textContent = 'OFFLINE'; connection.classList.add('offline'); }); setInterval(() => refresh().catch(() => {}), 3000); }
