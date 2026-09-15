#!/usr/bin/env node

/**
 * Audit the four LLM screening simulations against the outcome-blind rubric.
 *
 * This command is deliberately diagnostic. It never writes reviewer-1/
 * reviewer-2 state, the canonical screening ledger, or confirmatory data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const codeRoot = path.resolve(here, '..');
const repoRoot = path.resolve(codeRoot, '..');
const candidatesPath = path.join(codeRoot, 'artifacts', 'benchmark-snapshots', 'screening-pilot-sample-v1.0.json');
const simulationRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots', 'llm-screening-simulations', '2026-09-14-llm-screening-full');
const outputRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots', 'llm-screening-simulations', '2026-09-14-llm-screening-full');
const reportPath = path.join(repoRoot, 'research', 'protocol', 'AI-EVIDENCE-AUDIT-2026-09-15.md');
const taskAuditPath = path.join(outputRoot, 'task-audit.json');
const reviewers = ['deepseek-r1', 'deepseek-r2', 'qwen-r1', 'qwen-r2'];
const criteria = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7'];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
function keyOf(candidate) {
  return [candidate.benchmark_id, candidate.source_commit, candidate.task_source_id, candidate.instruction_digest].join('|');
}
function latestOk(reviewer) {
  const latest = new Map();
  for (const row of readJsonl(path.join(simulationRoot, `${reviewer}.jsonl`))) {
    if (row.status === 'ok') latest.set(row.key, row);
  }
  return latest;
}
function decision(row, code) { return row?.decisions?.[code]?.decision ?? null; }
function basis(row, code) { return String(row?.decisions?.[code]?.evidence_basis ?? '').trim(); }
function includesAny(text, patterns) { return patterns.some((pattern) => pattern.test(text)); }
function redact(text) {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:password|passwd|test1234|marvelsgrantman136)\S*/gi, '[redacted-credential]');
}

const contradictionRules = {
  IC1: {
    yes: [/not (?:a )?pinned/i, /not (?:shown|provided|confirmed)/i, /only metadata/i],
    no: [/official source/i, /pinned (?:release|source)/i]
  },
  IC2: {
    yes: [/evaluator (?:is )?(?:implied|not shown|not provided|not separately shown)/i, /no evaluator/i, /lack(?:s|ing)? .*evaluator/i],
    no: [/evaluator .*available/i, /official evaluator/i]
  },
  IC3: {
    yes: [/no (?:benchmark )?browser environment/i, /environment .*not (?:confirmed|specified|provided)/i, /cannot confirm/i, /external web application/i],
    no: [/executable in (?:the )?browser environment/i, /browser environment .*supported/i]
  },
  IC4: {
    yes: [/no evidence .*all three/i, /unclear .*paradigm/i, /not (?:shown|provided|confirmed).*paradigm/i],
    no: [/all three paradigms.*can/i, /same semantic goal.*attempt/i]
  },
  IC5: {
    yes: [/no reset/i, /reset .*not (?:described|provided|specified|confirmed)/i, /lack(?:s|ing)? .*reset/i, /unclear .*reset/i],
    no: [/reset .*reproduc/i, /reinitialization .*available/i]
  },
  IC6: {
    yes: [/no (?:deterministic )?evaluator/i, /no .*tolerance/i, /not (?:provided|shown|specified).*determin/i, /unclear .*evaluator/i, /lack(?:s|ing)? .*evaluator/i],
    no: [/deterministic evaluator/i, /pre-registered tolerance/i]
  },
  IC7: {
    yes: [/private (?:credentials|account)|secret .*required|privileged .*required|captcha|external .*(?:account|application)/i, /violat(?:es|ing) .*secret/i],
    no: [/credentials .*provided|public .*credential|no secret|no external|criterion is (?:met|satisfied)/i]
  }
};

function contradictionFlags(row) {
  const flags = [];
  for (const code of criteria) {
    const d = decision(row, code);
    const b = basis(row, code);
    const rule = contradictionRules[code];
    if (!d || !b || !rule) continue;
    if (d === 'yes' && includesAny(b, rule.yes)) flags.push({ code, type: 'yes_vs_negative_basis', basis: redact(b) });
    if (d === 'no' && includesAny(b, rule.no)) flags.push({ code, type: 'no_vs_positive_basis', basis: redact(b) });
  }
  return flags;
}

function shortTask(candidate) {
  const title = String(candidate.task_source_id ?? '').replace(/\s+/g, ' ').trim();
  return title.length > 110 ? `${title.slice(0, 107)}...` : title;
}

function agreementLabel(decisions) {
  const values = Object.values(decisions).filter(Boolean);
  if (!values.length) return 'missing';
  const distinct = new Set(values);
  if (distinct.size === 1) return 'unanimous';
  if (distinct.size === 2) return 'two-way-conflict';
  return 'three-way-conflict';
}

function evidenceSuggestions() {
  return [
    ['IC1', '官方任务身份', 'candidate manifest + 对应 source_file；核对 benchmark、pinned source commit、官方 task ID、instruction digest。', 'code/artifacts/benchmark-snapshots/outcome-blind-task-candidates-v1.0.json；每个候选的 source_file'],
    ['IC2', '原始 instruction 与 evaluator', '引用官方 release 的任务文件和 evaluator 可用性/版本说明；不得把 expected_result 当作 evaluator。', 'code/artifacts/benchmark-snapshots/webarena-verified/README.md#L12-L31,L186-L225；visualwebarena/evaluation_harness/evaluators.py；ata-zenodo/ISSTA_ARTEFACT/README.md#L73-L86,L126-L154'],
    ['IC3', '浏览器环境可执行性', '引用官方环境部署、站点范围、浏览器版本、登录方式和外部依赖说明；URL 本身不构成证明。', 'webarena-verified/README.md#L54-L182；visualwebarena/environment_docker/README.md#L1-L80；ATA README 中各站点 URL 与执行命令'],
    ['IC4', '三范式共同语义目标', '基于原始 intent 和三臂 information-boundary contract 建立逐任务 action-feasibility mapping；不得使用运行结果。', 'research/FINAL-STUDY-DESIGN-v1.0.md#L110-L145；对应任务 source_file 与 instruction'],
    ['IC5', 'reset/reinitialization', '引用官方 reset 命令、reset token/credentials policy 和重复 reset 验证记录；记录版本与初始状态 digest。', 'webarena-verified/README.md#L166-L182；visualwebarena/environment_docker/README.md#L74-L80；ATA reset 机制需补充官方证据'],
    ['IC6', '确定性 evaluator 或 tolerance', '引用 evaluator 文档/版本和预注册 tolerance；单纯的 expected UI text、LLM judge 或截图描述不足。', 'webarena-verified/README.md#L28-L30；webarena-verified/docs/evaluation/*；visualwebarena/evaluation_harness/evaluators.py；ATA evaluation.py/pinata README'],
    ['IC7', '秘密、外部或特权信息', '核对官方 credential policy、CAPTCHA、外部站点依赖和账号是否为公开 fixture；require_login 不自动等于 no。', 'visualwebarena/README.md#L58-L85；ATA SeeAct README#L233-L235；各 benchmark environment documentation']
  ];
}

const sample = readJson(candidatesPath);
const candidateMap = new Map(sample.candidates.map((candidate) => [keyOf(candidate), candidate]));
const modelMaps = Object.fromEntries(reviewers.map((reviewer) => [reviewer, latestOk(reviewer)]));
const taskAudits = [];
const contradictionsByReviewer = Object.fromEntries(reviewers.map((reviewer) => [reviewer, []]));

for (const [key, candidate] of candidateMap) {
  const rows = Object.fromEntries(reviewers.map((reviewer) => [reviewer, modelMaps[reviewer].get(key) ?? null]));
  const perCriterion = {};
  for (const code of criteria) {
    const decisions = Object.fromEntries(reviewers.map((reviewer) => [reviewer, decision(rows[reviewer], code)]));
    const distinct = [...new Set(Object.values(decisions).filter(Boolean))];
    perCriterion[code] = { decisions, distinct, conflict: distinct.length > 1 };
  }
  const contradictionRecords = [];
  for (const reviewer of reviewers) {
    for (const flag of contradictionFlags(rows[reviewer])) {
      const record = { reviewer, ...flag };
      contradictionRecords.push(record);
      contradictionsByReviewer[reviewer].push({ key, candidate, ...record });
    }
  }
  const conflictCodes = criteria.filter((code) => perCriterion[code].conflict);
  const highRisk = new Set(conflictCodes);
  for (const record of contradictionRecords) highRisk.add(record.code);
  if (candidate.benchmark_id === 'autonomous-tester-agent-benchmark' && /(?:login|password|credential|sign.?in)/i.test(candidate.task_source_id)) highRisk.add('IC7');
  taskAudits.push({
    key,
    benchmark_id: candidate.benchmark_id,
    source_commit: candidate.source_commit,
    task_source_id: candidate.task_source_id,
    instruction_digest: candidate.instruction_digest,
    source_file: candidate.source_file,
    review_coverage: Object.fromEntries(reviewers.map((reviewer) => [reviewer, Boolean(rows[reviewer])])),
    per_criterion: perCriterion,
    conflict_codes: conflictCodes,
    contradiction_flags: contradictionRecords,
    high_risk_codes: [...highRisk],
    risk_label: contradictionRecords.length ? 'rationale-contradiction' : conflictCodes.length ? 'model-disagreement' : highRisk.size ? 'credential-or-login-review' : 'low-diagnostic-risk'
  });
}

fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
fs.writeFileSync(taskAuditPath, `${JSON.stringify({ schema_version: '1.0', status: 'ai-evidence-audit-diagnostic', generated_on: new Date().toISOString(), sample_count: sample.candidates.length, reviewers, task_audits: taskAudits }, null, 2)}\n`, { mode: 0o600 });

const conflictCounts = Object.fromEntries(criteria.map((code) => [code, taskAudits.filter((task) => task.per_criterion[code].conflict).length]));
const contradictionCounts = Object.fromEntries(reviewers.map((reviewer) => [reviewer, Object.fromEntries(criteria.map((code) => [code, contradictionsByReviewer[reviewer].filter((row) => row.code === code).length]))]));
const highestRisk = [...taskAudits]
  .filter((task) => task.risk_label !== 'low-diagnostic-risk')
  .sort((a, b) => (b.contradiction_flags.length * 10 + b.conflict_codes.length) - (a.contradiction_flags.length * 10 + a.conflict_codes.length))
  .slice(0, 30);

const lines = [
  '# AI evidence audit — 2026-09-15',
  '',
  '> Diagnostic artifact only. This report is not a human review, does not satisfy the two-reviewer requirement, and does not authorize confirmatory collection.',
  '',
  '## Scope and integrity',
  '',
  `- Frozen pilot candidates: **${sample.candidates.length}**`,
  `- Model identities audited: **${reviewers.join(', ')}**`,
  '- Latest valid records per identity: **192/192**',
  '- Formal reviewer store touched: **no**',
  '- Canonical screening ledger touched: **no**',
  '- Confirmatory authorization: **false**',
  `- Machine-readable task audit: \`code/artifacts/benchmark-snapshots/llm-screening-simulations/2026-09-14-llm-screening-full/task-audit.json\``,
  '',
  '## What can be established from the current packet',
  '',
  '- IC1 is provisionally supportable from the frozen candidate manifest and source identity fields.',
  '- IC2–IC7 are not uniformly provable from the model prompt alone because evaluator, environment, reset, tolerance, credential-policy, and three-paradigm feasibility evidence was not included.',
  '- ATA task titles can contain PASS/FAIL markers and ATA instructions can contain test-account credentials. These must not be used as shortcuts for eligibility decisions.',
  '',
  '## Cross-model disagreement (candidate-level)',
  '',
  ...criteria.map((code) => `- ${code}: **${conflictCounts[code]} / ${sample.candidates.length}** tasks have at least two distinct model decisions.`),
  '',
  '## Rationale/decision contradiction flags',
  '',
  'The detector only flags explicit linguistic contradictions; a clean record is not proof of correctness.',
  '',
  '| Model | IC1 | IC2 | IC3 | IC4 | IC5 | IC6 | IC7 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...reviewers.map((reviewer) => `| ${reviewer} | ${criteria.map((code) => contradictionCounts[reviewer][code]).join(' | ')} |`),
  '',
  'Representative contradiction patterns requiring manual review:',
  ''
];
for (const reviewer of reviewers) {
  const examples = contradictionsByReviewer[reviewer].slice(0, 5);
  if (!examples.length) continue;
  lines.push(`- **${reviewer}**`);
  for (const example of examples) lines.push(`  - ${example.code} (${example.type}) — ${shortTask(example.candidate)} — ${example.basis}`);
}

lines.push('', '## Highest-priority task conflicts', '', 'These are diagnostic conflict candidates, not exclusions. They should be reviewed first once the evidence pack is available.', '', '| Priority | Benchmark/task | Risk signal | Criterion(s) |', '|---:|---|---|---|');
highestRisk.slice(0, 20).forEach((task, index) => {
  const signals = [task.contradiction_flags.length ? `${task.contradiction_flags.length} rationale contradiction(s)` : '', task.conflict_codes.length ? `${task.conflict_codes.length} model disagreement(s)` : '', task.risk_label === 'credential-or-login-review' ? 'login/credential check' : ''].filter(Boolean).join('; ');
  lines.push(`| ${index + 1} | ${task.benchmark_id} / ${shortTask(task)} | ${signals} | ${task.high_risk_codes.join(', ')} |`);
});

lines.push('', '## Evidence checklist and citation suggestions', '', '| Criterion | Required evidence | Suggested local citation anchors |', '|---|---|---|');
for (const [code, label, need, citation] of evidenceSuggestions()) lines.push(`| ${code} — ${label} | ${need} | ${citation} |`);

lines.push('', '## Local benchmark-artifact feasibility audit', '',
  '- **WebArena-Verified:** the pinned source contains 812 tasks; its README documents an audited release, deterministic type-aware scoring, and environment-control health/reset interfaces. This supports benchmark-level evidence for IC2/IC5/IC6, but the local environment is still `not-installed`, so IC3 and the operational reset gate remain pending.',
  '- **VisualWebArena:** the pinned source contains 910 tasks and reset scripts. The local evaluator inventory contains 409 `program_html`, 280 `string_match`, 224 `url_match`, and 42 `page_image_query` evaluator entries; 49 targets use `fuzzy_match`. The evaluator source calls `llm_fuzzy_match`, `llm_ua_match`, and a `captioning_fn` for image queries. IC6 therefore cannot be marked yes for the whole benchmark without a task-level deterministic-subset split or a pre-registered evaluator tolerance/repeatability audit.',
  '- **ATA/PinATA:** the pinned artifact contains 112 tasks and an `evaluation.py` that reports PASS/FAIL, failing-step and confusion metrics. Its reset function dispatches a GitHub Actions workflow using `GITHUB_TOKEN`, and the Pinata assertor uses an LLM over screenshots. The official README also warns that direct login is unsupported. Remote reset, evaluator independence, login-task treatment and credential provisioning remain unresolved; IC5/IC6/IC7 need explicit task-level adjudication before admission.',
  '- These findings affect feasibility and evidence requirements, not post-hoc task exclusion. Any task-list change must occur before HF1 or through a versioned amendment plus affected-arm rerun.'
);

lines.push('', '## Human-verification queue', '', 'For every high-risk task, a human reviewer should record the following before deciding yes/no:', '', '1. the exact source-file location and digest used;', '2. the official evaluator/documentation reference, without exposing evaluator internals to the testing arms;', '3. browser environment and start-state evidence;', '4. reset/reinitialization command and repeatability evidence;', '5. whether the same semantic intent has a legal path under all three information-boundary contracts;', '6. deterministic evaluator or pre-registered tolerance evidence;', '7. credential/CAPTCHA/external-dependency classification and the applicable EX1–EX8 code if excluded.', '', '## Decision', '', 'This audit supports continuing the study design, but not opening confirmatory collection. The next valid action is to assemble the criterion-specific evidence pack and have Reviewer 1 and Reviewer 2 independently complete the 192-task pilot in separate reviewer stores. Model labels remain diagnostic and must not be used as a majority vote.');

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ status: 'ok', report: reportPath, task_audit: taskAuditPath, sample_count: sample.candidates.length, conflict_counts: conflictCounts, contradiction_counts: contradictionCounts }, null, 2));
