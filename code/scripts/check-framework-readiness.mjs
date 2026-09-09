import { spawnSync } from 'node:child_process';
import { FRAMEWORK_VARIANTS } from '../src/framework-variants.mjs';

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return result.status === 0;
}

const packageCheck = spawnSync('npm', ['ls', '@browserbasehq/stagehand', '--depth=0', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
let stagehandInstalled = false;
try { stagehandInstalled = Boolean(JSON.parse(packageCheck.stdout).dependencies?.['@browserbasehq/stagehand']); } catch { stagehandInstalled = false; }
const pythonCheck = (module, executable = process.env.PYTHON || 'python3') => {
  const result = spawnSync(executable, ['-c', `import importlib.util; print(bool(importlib.util.find_spec('${module}')))`], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'True';
};
const browserUseReady = commandAvailable('browser-use');
const browserUsePython = process.env.PSS_BROWSER_USE_PYTHON || process.env.PSS_BROWSER_USE_BIN;
const agentLabPython = process.env.PSS_AGENTLAB_PYTHON || process.env.PSS_AGENTLAB_BIN;
const browserUseIsolatedReady = browserUsePython ? pythonCheck('browser_use', browserUsePython) : false;
const agentLabReady = pythonCheck('agentlab', agentLabPython || undefined);
const rows = [
  { framework: 'pss-native', ready: true, evidence: 'built-in' },
  { framework: 'stagehand', ready: stagehandInstalled, evidence: stagehandInstalled ? 'node package installed' : 'optional package not installed' },
  { framework: 'browser-use', ready: browserUseReady || browserUseIsolatedReady, evidence: browserUseReady ? 'CLI available' : (browserUseIsolatedReady ? `isolated Python import (${browserUsePython})` : 'uv/browser-use CLI or configured Python import not available') },
  { framework: 'agentlab-browsergym', ready: agentLabReady, evidence: agentLabReady ? (agentLabPython ? `configured Python import (${agentLabPython})` : 'Python module available') : 'Python module not installed' }
];
console.log(JSON.stringify({
  framework_variants: FRAMEWORK_VARIANTS,
  readiness: rows,
  configured_interpreters: { browser_use: browserUsePython || null, agentlab: agentLabPython || null },
  fail_closed: true
}, null, 2));
