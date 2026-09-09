/**
 * Optional external agent frameworks are recorded as separate implementation
 * variants. They never silently replace the native PSS driver or change the
 * meaning of the three primary arms.
 */
export const FRAMEWORK_VARIANTS = Object.freeze([
  {
    id: 'pss-native',
    family: 'visual+hybrid',
    mode: 'implemented',
    install: 'built-in',
    role: 'primary baseline and semantic-hybrid ablation'
  },
  {
    id: 'stagehand',
    family: 'visual+hybrid',
    mode: 'optional',
    install: 'npm install @browserbasehq/stagehand',
    role: 'Playwright-native CUA and grounded browser-agent comparison'
  },
  {
    id: 'browser-use',
    family: 'hybrid',
    mode: 'optional',
    install: 'uv tool install browser-use',
    role: 'external browser-agent hybrid baseline'
  },
  {
    id: 'agentlab-browsergym',
    family: 'hybrid',
    mode: 'optional',
    install: 'pip install agentlab && playwright install',
    role: 'benchmark/reproducibility and large-scale evaluation adapter'
  }
]);

export function findFrameworkVariant(id) {
  const variant = FRAMEWORK_VARIANTS.find((item) => item.id === id);
  if (!variant) throw new Error(`unknown framework variant: ${id}`);
  return variant;
}
