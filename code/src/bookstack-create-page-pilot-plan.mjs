import crypto from 'node:crypto';

export const BOOKSTACK_CREATE_PAGE_ARMS = Object.freeze(['playwright', 'visual', 'hybrid']);
export const BOOKSTACK_CREATE_PAGE_CONDITIONS = Object.freeze({
  'clean-stable': Object.freeze({ expectedVerdict: 'clean', uiMutation: null, applyFault: false }),
  'functional-fault:persistence-mismatch': Object.freeze({ expectedVerdict: 'fault', uiMutation: null, applyFault: true }),
  'ui-evolution:bookstack-layout-v1': Object.freeze({ expectedVerdict: 'clean', uiMutation: 'bookstack-layout-v1', applyFault: false })
});

const DEFAULT_CONFIGURATION_BY_ARM = Object.freeze({
  playwright: 'scripted-playwright-accessibility-human-v2',
  visual: 'visual-pss-native-aliyun-qwen3-7-flash-v1',
  hybrid: 'hybrid-pss-native-aliyun-qwen3-7-flash-v1'
});

function configurationByArm(provider, model) {
  if (provider === 'deepseek' && model === 'deepseek-v4-flash-vision-exp') {
    return Object.freeze({
      playwright: 'scripted-playwright-accessibility-human-v2',
      visual: 'visual-pss-native-deepseek-flash-v1',
      hybrid: 'hybrid-pss-native-deepseek-flash-v1'
    });
  }
  return DEFAULT_CONFIGURATION_BY_ARM;
}

function slug(value, fallback) {
  return String(value ?? '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || fallback;
}

function orderedArms(seed, repetition) {
  return [...BOOKSTACK_CREATE_PAGE_ARMS].sort((left, right) => crypto.createHash('sha256').update(`${seed}|${repetition}|${left}`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${seed}|${repetition}|${right}`).digest('hex')));
}

/**
 * Freeze the full cell schedule before a pilot starts.  This function does
 * not inspect credentials, start a browser, call a provider, or mutate a SUT.
 */
export function createBookStackCreatePagePilotPlan({
  condition = 'clean-stable', repetitions = 1,
  randomizationSeed = 'bookstack-create-page-phase2-v1', runTag = null,
  provider = null, model = null
} = {}) {
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('repetitions must be a positive integer');
  if (typeof randomizationSeed !== 'string' || !randomizationSeed.trim()) throw new Error('randomizationSeed must be non-empty');
  const conditionSpec = BOOKSTACK_CREATE_PAGE_CONDITIONS[condition];
  if (!conditionSpec) throw new Error(`Unsupported BookStack create-page condition: ${condition}`);
  const conditionSlug = slug(condition, 'condition');
  const tagSlug = runTag === null ? null : slug(runTag, '');
  if (runTag !== null && !tagSlug) throw new Error('runTag must contain at least one letter or digit');
  const blocks = [];
  const cells = [];
  const configurations = configurationByArm(provider, model);
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const arms = orderedArms(randomizationSeed, repetition);
    const tag = tagSlug ? `-${tagSlug}` : '';
    const randomizationBlock = `bookstack-create-page-${conditionSlug}${tag}-r${String(repetition).padStart(2, '0')}-${arms.join('-')}`;
    blocks.push({ repetition, randomizationBlock, arms });
    for (const arm of arms) {
      cells.push({
        repetition, arm, randomizationBlock,
        configurationId: configurations[arm],
        expectedVerdict: conditionSpec.expectedVerdict,
        externalModelCall: arm !== 'playwright'
      });
    }
  }
  return Object.freeze({
    taskId: 'bookstack-create-page', condition, conditionSpec, repetitions,
    randomizationSeed, runTag, blocks, cells,
    totalCells: cells.length,
    externalModelCalls: cells.filter((cell) => cell.externalModelCall).length,
    scriptedCells: cells.filter((cell) => !cell.externalModelCall).length
  });
}
