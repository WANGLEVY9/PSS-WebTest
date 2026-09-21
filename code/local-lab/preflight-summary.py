# -*- coding: utf-8 -*-
"""Export only sanitized engineering evidence; never method performance."""
import datetime
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

code=Path(__file__).resolve().parents[1]
root=code/'artifacts/local-runtime'
def read(name):
    file=root/name
    return json.loads(file.read_text()) if file.exists() else None
def junit(name):
    file=root/name
    if not file.exists(): return None
    suites=ET.parse(file).getroot().findall('testsuite')
    totals={k:sum(int(s.get(k,0)) for s in suites) for k in ['tests','failures','errors','skipped']}
    return {**totals,'passed':totals['tests']-totals['failures']-totals['errors']-totals['skipped']}
wav=read('wav-runtime-provenance.json')
vwa=read('vwa-native-preflight.json')
ata=read('ata-native-parser-preflight.json')
resets=[read(p.name) for p in sorted(root.glob('wav-reset-preflight-*.json'))]
files=['wav-runtime-provenance.json','vwa-runtime-provenance.json','wav-native-evaluator-20260921.xml',
       'vwa-native-actions-20260921.xml','wav-evaluator-edge-preflight.json','vwa-native-preflight.json',
       'ata-native-parser-preflight.json','ata-metric-preflight.json','vwa-capacity-preflight.json']
report={'kind':'PRE_COLLECTION_ENGINEERING_CHECKS','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'confirmatory_authorized':False,'new_benchmark_executions':0,
        'evidence_hashes':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files if (root/name).exists()},
        'wav':{'native_tests':junit('wav-native-evaluator-20260921.xml'),
               'installed_source_files_compared':wav['source_files_compared'] if wav else None,
               'installed_matches_source':wav['installed_matches_pinned_source'] if wav else None,
               'edge_case_probe':read('wav-evaluator-edge-preflight.json')},
        'vwa':{'official_action_tests':junit('vwa-native-actions-20260921.xml'),
               'synthetic_checks_passed':sum(c['passed'] for c in vwa['checks']) if vwa else None,
               'synthetic_checks_total':len(vwa['checks']) if vwa else None,
               'upstream_issues':vwa['upstream_issues'] if vwa else None,
               'runtime':{k:vwa[k] for k in ['python','playwright','chromium']} if vwa else None,
               'capacity':read('vwa-capacity-preflight.json'),
               'torch_status':'arm64 binary and CPU arithmetic verified; x86_64 wheel metadata conflicts with platform check; BLIP/VQA inference not verified'},
        'ata':{'official_parsed_candidates':ata['official_total'] if ata else None,
               'six_csv_parser_parity':ata['all_files_match'] if ata else None,
               'frozen_marker_inventory':112,'population_amendment_authorized':False,
               'metric_parity':read('ata-metric-preflight.json')},
        'reset_attempts':[{'run_id':r['run_id'],'status':r['status'],'cycles_completed':len(r['cycles']),
                           'state_reset_verified':r['state_reset_verified'],'failure':r.get('error') or r.get('termination_reason'),
                           'finished_at':r.get('finished_at')} for r in resets],
        'limitations':['No three-benchmark admission','No new model requests or agent performance evidence',
                       'No human review/adjudication substituted','No unchanged-official-source claim for PSS adapters',
                       'Reset probes cover review-related contents only, not full benchmark task state']}
for destination in [root/'preflight-summary.json',code/'../results/local-runtime/2026-09-21-preflight-summary.json']:
    destination.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'confirmatory_authorized':False,'new_benchmark_executions':0,'evidence_files':len(report['evidence_hashes']),
                  'wav_native_tests':report['wav']['native_tests'],'vwa_official_action_tests':report['vwa']['official_action_tests'],
                  'ata_parsed':report['ata']['official_parsed_candidates']}))
