import { spawnSync } from 'node:child_process';
import { FRAMEWORK_VARIANTS } from '../src/framework-variants.mjs';

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return result.status === 0;
}

const packageCheck = spawnSync('npm', ['ls', '@browserbasehq/stagehand', '--depth=0', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
let stagehandInstalled = false;
try { stagehandInstalled = Boolean(JSON.parse(packageCheck.stdout).dependencies?.['@browserbasehq/stagehand']); } catch { stagehandInstalled = false; }
const pythonCheck = (module) => {
  const result = spawnSync('python3', ['-c', `import importlib.util; print(bool(importlib.util.find_spec('${module}')))`], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'True';
};
const browserUseReady = commandAvailable('browser-use');
const agentLabReady = pythonCheck('agentlab');
const rows = [
  { framework: 'pss-native', ready: true, evidence: 'built-in' },
  { framework: 'stagehand', ready: stagehandInstalled, evidence: stagehandInstalled ? 'node package installed' : 'optional package not installed' },
  { framework: 'browser-use', ready: browserUseReady, evidence: browserUseReady ? 'CLI available' : 'uv/browser-use CLI not available' },
  { framework: 'agentlab-browsergym', ready: agentLabReady, evidence: agentLabReady ? 'Python module available' : 'Python module not installed' }
];
console.log(JSON.stringify({ framework_variants: FRAMEWORK_VARIANTS, readiness: rows, fail_closed: true }, null, 2));
