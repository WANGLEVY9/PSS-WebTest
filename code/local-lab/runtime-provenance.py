# -*- coding: utf-8 -*-
"""Record installed runtime facts without reading credentials or task gold."""
import hashlib
import importlib.metadata as metadata
import json
import platform
import sys
from pathlib import Path

code=Path(__file__).resolve().parents[1]
which=sys.argv[1]
if which not in ['wav','vwa']:
    raise ValueError('Expected wav or vwa')
packages=sorted([{'name':d.metadata['Name'],'version':d.version} for d in metadata.distributions()],key=lambda p:p['name'].lower())
report={'kind':'RUNTIME_PROVENANCE','benchmark':which,'python':sys.version.split()[0],
        'machine':platform.machine(),'platform':platform.platform(),'packages':packages,
        'confirmatory_authorized':False}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if which=='wav':
    import webarena_verified
    source=code/'artifacts/benchmark-snapshots/webarena-verified/src/webarena_verified'
    installed=Path(webarena_verified.__file__).parent
    rows=[]
    for p in sorted(source.rglob('*.py')):
        relative=p.relative_to(source)
        target=installed/relative
        rows.append({'file':str(relative),'source_sha256':sha(p),
                     'installed_sha256':sha(target) if target.exists() else None})
    report['source_comparison']=rows
    report['source_files_compared']=len(rows)
    report['installed_matches_pinned_source']=bool(rows) and all(r['source_sha256']==r['installed_sha256'] for r in rows)
else:
    import torch
    report['torch_wheel_metadata']=metadata.distribution('torch').read_text('WHEEL')
    report['torch_cpu_tensor_sum']=float((torch.ones(2,2)@torch.ones(2,2)).sum())
    report['torch_note']='uv pip check reports wheel platform metadata mismatch; CPU arithmetic passes, VQA model inference remains unverified. Do not edit metadata or silently upgrade official torch pin.'
(code/f'artifacts/local-runtime/{which}-runtime-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['packages','source_comparison']}))
