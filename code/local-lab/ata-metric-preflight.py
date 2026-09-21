# -*- coding: utf-8 -*-
"""Parity of defined ATA metrics with verbatim official formula AST only.

Never import/run upstream evaluation.py, whose runner dispatches remote resets.
"""
import ast
import hashlib
import itertools
import json
import subprocess
from pathlib import Path

code=Path(__file__).resolve().parents[1]
source=code/'artifacts/benchmark-snapshots/ata-zenodo/ISSTA_ARTEFACT/pinata/evaluation.py'
tree=ast.parse(source.read_text())
function=next(n for n in tree.body if isinstance(n,ast.AsyncFunctionDef) and n.name=='run_evaluation')
start=next(i for i,n in enumerate(function.body) if isinstance(n,ast.Assign) and ast.unparse(n.targets[0])=="metrics['TP']")
formula_nodes=[n for n in function.body[start:] if not isinstance(n,ast.Return)]
formula_ast=ast.Module(body=formula_nodes,type_ignores=[])
assert not any(isinstance(n,(ast.Call,ast.Import,ast.ImportFrom,ast.Await,ast.For,ast.While)) for n in ast.walk(formula_ast))
compiled=compile(formula_ast,str(source),'exec')
types=[{'gold':'P','predicted':'PASS'},{'gold':'P','predicted':'FAIL'},
       {'gold':'F','predicted':'PASS'},*[{'gold':'F','predicted':'FAIL','step':s,'expected_step':2} for s in [1,2,3]]]
fixtures=list(itertools.product(types,repeat=3))
node="import fs from 'node:fs'; import {scoreAta} from './local-lab/ata-verdict-contract.mjs'; console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(scoreAta)));"
ours=json.loads(subprocess.check_output(['node','--input-type=module','-e',node],input=json.dumps(fixtures).encode(),cwd=code))
mapping={'accuracy':'conditional_verdict_accuracy','specificity':'specificity','sensitivity':'sensitivity',
         'AER':'AER','HER':'HER','SMER':'SMER','truacc':'strict_step_accuracy'}
mismatches=[]; defined_comparisons=0; undefined_conventions=0
for i,rows in enumerate(fixtures):
    m={k:0 for k in ['FN','TN','FP','AFA','AFB','AFC']}
    for r in rows:
        if r['predicted']=='PASS': m['TN' if r['gold']=='P' else 'FN']+=1
        elif r['gold']=='P': m['FP']+=1
        else: m['AFB' if r['step']<2 else 'AFA' if r['step']>2 else 'AFC']+=1
    exec(compiled,{'__builtins__':{}},{'metrics':m})
    for field,target in mapping.items():
        observed=ours[i][target]
        if observed is None:
            # Declared reporting deviation: undefined rate is null, not native zero.
            undefined_conventions+=1
            if m[field]!=0: mismatches.append({'fixture':i,'field':field,'issue':'unexpected undefined metric'})
        else:
            defined_comparisons+=1
            if abs(m[field]-observed)>1e-12: mismatches.append({'fixture':i,'field':field})
report={'kind':'ATA_NATIVE_METRIC_FORMULA_PARITY','confirmatory_authorized':False,
        'synthetic_fixtures':len(fixtures),'defined_metric_comparisons':defined_comparisons,
        'mismatches':mismatches,'undefined_rate_convention_differences':undefined_conventions,
        'official_source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'formula_ast_sha256':hashlib.sha256(ast.dump(formula_ast).encode()).hexdigest(),
        'benchmark_task_executions':0,
        'scope':'Valid PASS/FAIL verdicts and well-formed failure steps only. PSS reports undefined rates as null rather than official zero. Missing verdicts and invalid steps retain separate deployment accounting; not native-formula parity claims.'}
(code/'artifacts/local-runtime/ata-metric-preflight.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if mismatches: raise SystemExit(1)
