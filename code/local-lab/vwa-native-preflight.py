# -*- coding: utf-8 -*-
"""Native VWA component checks on synthetic inputs only; no task execution."""
import json
import os
import sys
from pathlib import Path
from importlib.metadata import version

# These are deliberately unreachable placeholders for offline component imports,
# not environment readiness or real site configuration.
os.environ['DATASET'] = 'visualwebarena'
for key in ['CLASSIFIEDS', 'SHOPPING', 'REDDIT', 'WIKIPEDIA', 'HOMEPAGE']:
    os.environ[key] = 'http://' + key.lower() + '.test.invalid'
os.environ['CLASSIFIEDS_RESET_TOKEN'] = 'offline-fixture-only'
# Upstream imports instantiate OpenAI even for deterministic evaluators.
# A non-secret placeholder plus closed local endpoint prevents real provider use.
os.environ['OPENAI_API_KEY'] = 'offline-fixture-not-a-credential'
os.environ['OPENAI_BASE_URL'] = 'http://127.0.0.1:9/v1'
from browser_env import ActionTypes, create_mouse_click_action
from browser_env.actions import create_clear_action, is_equivalent, execute_mouse_click, execute_scroll
from evaluation_harness import StringEvaluator
from evaluation_harness.evaluators import NumericEvaluator
from evaluation_harness.image_utils import get_image_ssim
from PIL import Image
from playwright.sync_api import sync_playwright

checks = []
def check(name, actual, expected):
    passed = actual == expected
    checks.append({'name': name, 'actual': actual, 'expected': expected, 'passed': passed})
    if not passed:
        raise AssertionError(name)

check('exact positive', StringEvaluator.exact_match('Fixture answer', 'fixture answer'), 1.0)
check('exact negative', StringEvaluator.exact_match('Fixture answer', 'incorrect'), 0.0)
check('numeric positive', NumericEvaluator.compare_inequality(9, '< 10'), True)
check('numeric negative', NumericEvaluator.compare_inequality(11, '< 10'), False)
a, b = Image.new('RGB', (32,32), 'white'), Image.new('RGB', (32,32), 'black')
check('identical image SSIM', float(get_image_ssim(a,a)), 1.0)
check('different image SSIM', bool(get_image_ssim(a,b) < 0.01), True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    browser_version = browser.version
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.route('**/*', lambda route: route.abort())
    page.set_content('<body style="margin:0;height:4000px"><script>window.points=[];window.onclick=e=>points.push([e.clientX,e.clientY]);</script>')
    execute_mouse_click(0.5,0.5,page)
    check('native normalized center click', page.evaluate('points'), [[640,360]])
    execute_scroll('down',page)
    check('native page-sized downward scroll', page.evaluate('scrollY'), 720)
    execute_scroll('up',page)
    check('native upward scroll', page.evaluate('scrollY'), 0)
    browser.close()

# Preserve upstream defects; do not patch evaluator/source to obtain a green gate.
issues = []
try:
    action = create_clear_action(element_id='synthetic-control')
    is_equivalent(action,action)
except ValueError as e:
    issues.append({'component':'is_equivalent(CLEAR,CLEAR)', 'error':str(e)})
import browser_env
if 'create_clear_action' not in browser_env.__all__:
    issues.append({'component':'public action exports', 'error':'create_clear_action missing from __all__'})
if create_mouse_click_action(0.0,0.0)['action_type'] != ActionTypes.MOUSE_CLICK:
    issues.append({'component':'create_mouse_click_action(0,0)', 'error':'zero coordinates produce CLICK rather than MOUSE_CLICK'})
report = {'kind':'VWA_NATIVE_COMPONENT_PREFLIGHT','confirmatory_authorized':False,
          'benchmark_task_executions':0,'site_readiness_verified':False,
          'python':sys.version.split()[0], 'playwright':version('playwright'),
          'chromium':browser_version, 'checks':checks, 'upstream_issues':issues,
          'vqa_or_llm_judge_verified':False,
          'note':'Synthetic component checks do not admit VWA. Native scroll uses one viewport via JS, not PSS pixel wheel deltas. No silent action-set substitution.'}
destination=Path(__file__).resolve().parents[1]/'artifacts/local-runtime/vwa-native-preflight.json'
destination.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
