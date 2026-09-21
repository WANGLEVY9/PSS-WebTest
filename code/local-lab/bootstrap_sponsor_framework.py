"""Provision a NEW native Linux framework venv from a reviewed exact lock.

Default is plan-only. Never edits locks, upgrades an existing venv, copies keys,
pulls fixture images or starts experiments. No claim of Linux install success can
be made on the developer's macOS host.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess


def plan_install(framework, lock, lock_sha256, prefix, python, uv, system=None, machine=None, install_browser=False):
    raw = Path(lock).read_bytes()
    if hashlib.sha256(raw).hexdigest() != lock_sha256:
        raise ValueError('Reviewed lock drift')
    pins = {}
    for line in raw.decode().splitlines():
        line = line.strip()
        if not line or line.startswith('#'): continue
        match = re.fullmatch(r'([A-Za-z0-9_.-]+)==([^\s;]+)', line)
        if not match: raise ValueError('Exact reviewed pins required; resolve markers/URLs explicitly first')
        name = re.sub(r'[-_.]+', '-', match[1]).lower()
        if name in pins: raise ValueError('Duplicate dependency pin')
        if name.startswith('pyobjc-'): raise ValueError('macOS-only lock cannot be installed on sponsor Linux; resolve a separate reviewed Linux lock')
        pins[name] = match[2]
    required = 'agentlab' if framework == 'agentlab' else 'browser-use'
    if not pins or required not in pins: raise ValueError('Framework absent from exact lock')
    target = Path(prefix)
    if not target.is_absolute() or target.exists() or not target.parent.is_dir():
        raise ValueError('New absolute environment directory with existing parent required')
    for tool in (python, uv):
        if not Path(tool).is_absolute() or not os.access(tool, os.X_OK):
            raise ValueError('Explicit existing executable required')
    if install_browser and 'playwright' not in pins:
        raise ValueError('Browser provisioning requires playwright in the reviewed full lock')
    return {'framework': framework, 'lock_sha256': lock_sha256, 'pins': pins,
            'native_host': (system or platform.system()) == 'Linux' and (machine or platform.machine()) in ('x86_64', 'AMD64'),
            'commands': [[uv, 'venv', '--python', python, str(target)],
                         [uv, 'pip', 'sync', '--python', str(target/'bin/python'), str(Path(lock).resolve())],
                         [uv, 'pip', 'check', '--python', str(target/'bin/python')]] +
                        ([[str(target/'bin/python'),'-m','playwright','install','chromium']] if install_browser else []),
            'browser_install_requested':install_browser,
            'model_requests': 0, 'benchmark_executions': 0, 'confirmatory_authorized': False}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--framework', required=True, choices=('agentlab', 'browser-use'))
    for name in ('lock', 'lock-sha256', 'prefix', 'python', 'uv', 'output'):
        p.add_argument('--' + name, required=True)
    p.add_argument('--execute', action='store_true')
    p.add_argument('--install-browser',action='store_true',help='Install the exact pinned Playwright Chromium; system libraries remain host provisioning')
    args = p.parse_args()
    report = plan_install(args.framework, args.lock, args.lock_sha256, args.prefix, args.python, args.uv, install_browser=args.install_browser)
    report['kind'] = 'SPONSOR_FRAMEWORK_INSTALLATION'
    report['executed'] = False
    report['installed'] = False
    # Reserve a private new output directory BEFORE any install side effect.
    out = Path(args.output)
    out.mkdir(mode=0o700)
    if args.execute:
        if not report['native_host']:
            raise ValueError('Execution requires native Linux x86_64; no emulation fallback')
        report['executed'] = True
        report['steps'] = []
        # Credentials never need to be inherited by package installation.
        env = {k: v for k, v in os.environ.items() if not re.search(r'API_KEY|TOKEN|SECRET|PASSWORD|^CUA_|^PSS_|^OPENAI_', k)}
        for index, command in enumerate(report['commands']):
            log = out / f'install-{index}.log'
            fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as stream:
                try:
                    result = subprocess.run(command, env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=1200)
                    status, error = result.returncode, None
                except (subprocess.TimeoutExpired, OSError) as exc:
                    status, error = None, type(exc).__name__
            report['steps'].append({'index': index, 'exit_code': status, 'error_type': error, 'log_sha256': hashlib.sha256(log.read_bytes()).hexdigest()})
            if status != 0: break
        report['installed'] = len(report['steps']) == len(report['commands']) and all(s['exit_code'] == 0 for s in report['steps'])
    report['remaining'] = ['exact installed distribution/import audit', 'native component probes', 'fixture/reset/evaluator/API acceptance']
    from prepare_official_runtime import save
    save(out/'report.json', report)
    print(json.dumps(report))
    if args.execute and not report['installed']: raise SystemExit(2)


if __name__ == '__main__': main()
