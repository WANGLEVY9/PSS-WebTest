# -*- coding: utf-8 -*-
"""Compare PSS artifact preparation with the bundled official ATA parser.

No actor, orchestrator, LLM or remote reset module is imported.
"""
import hashlib
import json
import os
import runpy
import sys
import tempfile
from pathlib import Path

code=Path(__file__).resolve().parents[1]
artifact=code/'artifacts/benchmark-snapshots/ata-zenodo/ISSTA_ARTEFACT'
sys.path.insert(0,str(artifact/'pinata/src'))
# Official utils imports call load_dotenv. Parser checks need no credentials.
os.environ['PYTHON_DOTENV_DISABLED']='1'
from VTAAS.data.testcase import TestCaseCollection
prepare=runpy.run_path(str(code/'local-lab/prepare-ata.py'))
rows=[]
with tempfile.TemporaryDirectory(prefix='pss-ata-parser-') as temporary:
    for file in sorted((artifact/'benchmark').glob('*.csv')):
        ours=prepare['parse_file'](file)
        try:
            native=TestCaseCollection(str(file),'http://offline.test.invalid',str(Path(temporary)/file.stem)).test_cases
            mismatches=[]
            for i,(a,b) in enumerate(zip(ours,native)):
                comparisons={
                    'title':a['title']==b.name,
                    'label':a['label']==b.type,
                    'actions':[(s['action'],s['expectedResult']) for s in a['steps']]==list(b.steps),
                    'failure_step': (a['failures'][0]['step'] if len(a['failures'])==1 else None)==getattr(b,'failing_step',None),
                }
                if not all(comparisons.values()):
                    mismatches.append({'source_position':i+1,'fields':[k for k,v in comparisons.items() if not v]})
            rows.append({'source_file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
                         'pss_count':len(ours),'official_count':len(native),'mismatches':mismatches,
                         'parity':len(ours)==len(native) and not mismatches})
        except Exception as e:
            rows.append({'source_file':file.name,'pss_count':len(ours),'official_count':None,
                         'parity':False,'error':type(e).__name__+': '+str(e)})
report={'kind':'ATA_NATIVE_PARSER_PARITY','confirmatory_authorized':False,
        'benchmark_task_executions':0,'rows':rows,
        'all_files_match':bool(rows) and all(r['parity'] for r in rows),
        'official_total':sum(r['official_count'] or 0 for r in rows),
        'frozen_marker_inventory':112,
        'note':'Parser parity does not authorize the 112-to-113 population amendment or resolve duplicate source indices. Human adjudication and live fixture-label parity remain required.'}
(code/'artifacts/local-runtime/ata-native-parser-preflight.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
