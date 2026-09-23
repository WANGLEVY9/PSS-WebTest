"""Offline conformance probe against the installed PINNED official WAV source.

Exercises native public parsing and task aggregation, not browser tasks. No API
calls, native evaluator patching, gold-answer injection or benchmark admission.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from benchmark_output_contract import WAV_TASK_TYPES, WAV_STATUSES
from native_eval_contract import wav_endpoint
from prepare_navigation_runtime import PINS
from prepare_official_runtime import save


def probe(source):
    from webarena_verified.types import agent_response, eval as native
    from pydantic import ValidationError
    source=Path(source).resolve()
    head=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    dirty=subprocess.check_output(['git','-C',str(source),'status','--porcelain','--untracked-files=no'],text=True).strip()
    if head != PINS['wav'] or dirty: raise ValueError('Pinned clean WAV source required')
    # A wheel installation lives in site-packages, not the source checkout.
    # Compare actual bytes instead of mistaking its path for source drift.
    for module in (agent_response,native):
        installed=Path(module.__file__).resolve()
        pinned=source/'src/webarena_verified/types'/installed.name
        if installed.read_bytes()!=pinned.read_bytes(): raise ValueError('Installed WAV source mismatch')
    schema=agent_response.FinalAgentResponse.model_json_schema()
    if (schema['$defs']['MainObjectiveType']['enum']!=list(WAV_TASK_TYPES)
        or schema['$defs']['Status']['enum']!=list(WAV_STATUSES)
        or schema['required']!=['task_type','status']):
        raise ValueError('Public response contract differs from upstream')
    rows=[]
    for scores, error in [([1,1],False),([1,0],False),([0,0],False),([1,0],True)]:
        children=[native.EvaluatorResult(evaluator_name='synthetic-contract-control',
            status=native.EvalStatus.ERROR if error and i==1 else
                native.EvalStatus.SUCCESS if score else native.EvalStatus.FAILURE,
            score=float(score)) for i,score in enumerate(scores)]
        result=native.TaskEvalResult.create(task_id=1,intent_template_id=1,sites=('shopping',),
            task_revision=1,data_checksum='SYNTHETIC_CONTROL',evaluators_results=children)
        endpoint=wav_endpoint(result.model_dump(mode='json'),1)
        expected=None if error else int(all(scores))
        if endpoint['native_score']!=expected: raise ValueError('Native endpoint mismatch')
        rows.append({'child_scores':scores,'has_evaluator_error':error,
            'official_status':result.status.value,'official_score':result.score,'normalized':endpoint})
    invalid=0
    for response in ['not JSON','{}','{"task_type":"RETRIEVE","status":"invented"}']:
        try: agent_response.FinalAgentResponse.model_validate_json(response)
        except ValidationError: invalid+=1
    if invalid!=3: raise ValueError('Native parser negative control failed')
    return {'kind':'WAV_NATIVE_CONTRACT_PROBE','passed':True,'source_commit':head,
        'sources':{Path(m.__file__).name:hashlib.sha256(Path(m.__file__).read_bytes()).hexdigest()
                   for m in (agent_response,native)},
        'public_schema_matched':True,'aggregation_controls':rows,'invalid_parser_controls':invalid,
        'data_kind':'SYNTHETIC_CONTROL','model_requests':0,'benchmark_executions':0,
        'confirmatory_authorized':False,
        'limitation':'Native class/parser conformance only, not live website/evaluator/reset acceptance.'}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
    a=p.parse_args();report=probe(a.source);save(Path(a.output),report);print(json.dumps(report))
