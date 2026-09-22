"""Owned, mount-free WAV fixture lifecycle; no agents, gold, or provider calls.

Upstream's actual reset semantics are delete -> create -> initialize, NOT the
documentation's stale /reset example or env-ctrl init (which only configures
URLs/cache). Each opportunity uses a new writable layer from an exact local
image. No image pulls, existing primary reuse, persistent volumes, or public
port bindings are permitted. Source/manifest/data are supervisor-only.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

SCHEMA = 'pss-wav-owned-fixture-v1'
PIN = '6473f72db5dcefc97b5725b59e734504edc28a21'
IDENTITY = ('opportunity_id', 'environment_id', 'configuration_sha256', 'scope', 'data_kind')
SOURCE_FILES = ('src/webarena_verified/environments/site_handler.py',
                'src/webarena_verified/environments/container/manager.py',
                'packages/environment_control/environment_control/ops/sites/shopping.py')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_ref(ref):
    if not isinstance(ref, dict) or set(ref) != {'file', 'sha256'}:
        raise ValueError('Exact pinned reference required')
    raw = Path(ref['file']).read_bytes()
    if digest(raw) != ref['sha256']:
        raise ValueError('Pinned artifact drift')
    return json.loads(raw)


def write_new(file, value):
    raw = (json.dumps(value, indent=2, sort_keys=True, allow_nan=False)+'\n').encode()
    fd = os.open(file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    return {'file': str(file), 'sha256': digest(raw)}


def validate_manifest(m):
    if m.get('schema') != SCHEMA or m.get('source_commit') != PIN:
        raise ValueError('Pinned WAV lifecycle manifest required')
    if not isinstance(m.get('docker_context'), str) or not re.fullmatch(r'[\w.-]+', m['docker_context']):
        raise ValueError('Explicit Docker context required')
    if not re.fullmatch(r'pss-wav-[a-z0-9-]{1,45}', m.get('namespace', '')):
        raise ValueError('Dedicated pss-wav namespace required')
    if not isinstance(m.get('environment_id'), str) or not m['environment_id']:
        raise ValueError('Frozen environment identity required')
    if type(m.get('startup_timeout_s')) is not int or not 30 <= m['startup_timeout_s'] <= 900:
        raise ValueError('Bounded provisioning timeout required')
    if not Path(m.get('artifact_root', '')).is_absolute() or not Path(m.get('source_directory', '')).is_absolute():
        raise ValueError('Absolute owned artifact/source paths required')
    if not isinstance(m.get('sites'), list) or not m['sites']:
        raise ValueError('Complete dependency-site list required')
    names = set(); ports = set()
    for site in m['sites']:
        # Additional sites need their native health configuration. Do not reuse
        # shopping credentials/health as a guessed universal implementation.
        if site.get('site') != 'shopping' or site['site'] in names:
            raise ValueError('Only shopping lifecycle is implemented; missing dependencies fail closed')
        names.add(site['site'])
        if not re.fullmatch(r'[A-Za-z0-9./_-]+@sha256:[a-f0-9]{64}', site.get('image', '')):
            raise ValueError('Immutable image manifest digest required')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', site.get('image_id', '')):
            raise ValueError('Pinned local image config ID required')
        for key in ('http_port', 'control_port'):
            p = site.get(key)
            if type(p) is not int or not 1024 <= p <= 65535 or p in ports:
                raise ValueError('Distinct nonprivileged loopback ports required')
            ports.add(p)
    return m


def validate_owned(info, name, image_id, owner, network_name):
    labels = info.get('Config', {}).get('Labels') or {}
    if (info.get('Name') != '/' + name or info.get('Image') != image_id
            or labels.get('pss.wav.owner') != owner or info.get('Mounts') != []):
        raise ValueError('Refuse lifecycle operation: foreign container/image/mount')
    host = info.get('HostConfig', {})
    if host.get('Privileged') or host.get('NetworkMode') != network_name or host.get('VolumesFrom'):
        raise ValueError('Refuse shared/privileged fixture')
    if set(info.get('NetworkSettings', {}).get('Networks', {})) != {network_name}:
        raise ValueError('Unexpected fixture network attachment')
    for bindings in (host.get('PortBindings') or {}).values():
        if not bindings or any(v.get('HostIp') != '127.0.0.1' for v in bindings):
            raise ValueError('Nonloopback fixture binding forbidden')
    return info


class Docker:
    def __init__(self, context):
        self.context = context

    def run(self, args, timeout=120):
        p = subprocess.run(['docker', '--context', self.context, *args],
                           capture_output=True, text=True, timeout=timeout, check=False)
        if p.returncode:
            # Do not print fixture DB credentials, host environment, or raw SQL.
            raise RuntimeError('Docker operation failed: '+args[0])
        return p.stdout.strip()

    def inspect(self, name):
        return json.loads(self.run(['inspect', name]))[0]

    def exists(self, name):
        return bool(self.run(['ps', '-a', '--filter', 'name=^/'+name+'$', '--format', '{{.Names}}']))


class OwnedLifecycle:
    def __init__(self, manifest, manifest_sha256, payload, docker=None):
        self.m = validate_manifest(manifest)
        self.manifest_sha256 = manifest_sha256
        if any(not isinstance(payload.get(k), str) or not payload[k] for k in IDENTITY):
            raise ValueError('Explicit execution/provenance identity required')
        if payload['scope'] != 'diagnostic' or payload['data_kind'] != 'MEASURED':
            raise ValueError('Real diagnostic lifecycle only; no fabricated formal admission')
        if payload['environment_id'] != self.m['environment_id']:
            raise ValueError('Environment binding mismatch')
        self.identity = {k: payload[k] for k in IDENTITY}
        if 'lease_token' in payload:
            if not isinstance(payload['lease_token'],str) or not payload['lease_token']:
                raise ValueError('Nonempty lease token required')
            self.identity['lease_token']=payload['lease_token']
        self.token = digest((payload['opportunity_id']+'\0'+manifest_sha256+
                             ('\0'+payload['lease_token'] if 'lease_token' in payload else '')).encode())[:16]
        self.owner = digest(json.dumps(self.identity, sort_keys=True).encode()+manifest_sha256.encode())
        self.network = self.m['namespace']+'-'+self.token
        self.names = {s['site']: self.network+'-'+s['site'] for s in self.m['sites']}
        self.directory = Path(self.m['artifact_root']) / self.token
        self.d = docker or Docker(self.m['docker_context'])

    def sources(self):
        source = Path(self.m['source_directory'])
        head = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
        dirty = subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain', '--untracked-files=no'], text=True).strip()
        if head != PIN or dirty:
            raise ValueError('Official source pin/cleanliness drift')
        return {name: digest((source/name).read_bytes()) for name in SOURCE_FILES}

    def owned(self, site):
        name = self.names[site['site']]
        info = validate_owned(self.d.inspect(name), name, site['image_id'], self.owner, self.network)
        wanted = {'80/tcp': [{'HostIp': '127.0.0.1', 'HostPort': str(site['http_port'])}],
                  '8877/tcp': [{'HostIp': '127.0.0.1', 'HostPort': str(site['control_port'])}]}
        if info['HostConfig'].get('PortBindings') != wanted:
            raise ValueError('Frozen port binding drift')
        return info

    def network_owned(self):
        info = json.loads(self.d.run(['network', 'inspect', self.network]))[0]
        if (info.get('Labels', {}).get('pss.wav.owner') != self.owner or info.get('Internal') is not False
                or info.get('Driver') != 'bridge'
                or info.get('Options',{}).get('com.docker.network.bridge.enable_icc')!='false'):
            raise ValueError('Foreign/shared fixture network or missing inter-container isolation')
        allowed = {self.owned(s)['Id'] for s in self.m['sites'] if self.d.exists(self.names[s['site']])}
        if set((info.get('Containers') or {}).keys()) - allowed:
            raise ValueError('Unexpected neighboring container on fixture network')
        return info

    def sql(self, site, query):
        self.owned(site)
        return self.d.run(['exec', self.names[site['site']], 'mysql', '-N', '-B', '-umagentouser',
                           '-pMyPassword', 'magentodb', '-e', query])

    def await_ready(self, site):
        deadline = time.monotonic() + self.m['startup_timeout_s']
        observations = []
        required = {'mysqld', 'elasticsearch', 'redis-server', 'php-fpm', 'nginx', 'cron', 'mailcatcher', 'env-ctrl'}
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen('http://127.0.0.1:%d/status' % site['control_port'], timeout=10) as r:
                    body = json.load(r)
                services = body.get('details', {}).get('value', {}).get('services', {})
                ready = body.get('success') is True and all(services.get(k) in ('HEALTHY', 'RUNNING') for k in required)
                observations.append({'elapsed_s': self.m['startup_timeout_s']-(deadline-time.monotonic()), 'services': services, 'ready': ready})
                # A healthy server can precede the one-shot URL initializer.
                url = 'http://127.0.0.1:%d/' % site['http_port']
                if ready and self.sql(site, "SELECT value FROM core_config_data WHERE path IN ('web/unsecure/base_url','web/secure/base_url') ORDER BY path").splitlines() == [url, url]:
                    break
            except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
                pass
            time.sleep(min(5, max(0, deadline-time.monotonic())))
        else:
            raise TimeoutError('Official service/base-URL provisioning gate did not complete')
        # Exactly one warmup; repeated cancelled requests accumulate PHP workers.
        begin = time.monotonic()
        with urllib.request.urlopen(url, timeout=min(90, max(1, deadline-time.monotonic()))) as response:
            body = response.read()
            if response.status != 200 or b'<html' not in body or b'Fatal error' in body:
                raise ValueError('Official homepage gate failed')
        return {'services': observations[-1], 'homepage_status': 200,
                'homepage_elapsed_ms': (time.monotonic()-begin)*1000,
                'homepage_bytes': len(body), 'base_urls_match': True}

    def reset(self, payload):
        if payload.get('baseline_sha256') != self.manifest_sha256:
            raise ValueError('Baseline must equal frozen fixture manifest')
        setup = read_ref(payload['setup_ref'])
        if setup.get('reset_before_each_arm') is not True or set(setup.get('sites', [])) != {s['site'] for s in self.m['sites']}:
            raise ValueError('Missing/extra task dependency site; no partial reset admission')
        source_hashes = self.sources()
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=False)
        images = {}
        for site in self.m['sites']:
            if self.d.exists(self.names[site['site']]):
                raise ValueError('Existing fixture quarantined; never adopt or silently retry')
            info = json.loads(self.d.run(['image', 'inspect', site['image']]))[0]
            if info.get('Id') != site['image_id'] or site['image'] not in info.get('RepoDigests', []):
                raise ValueError('Local image manifest/config digest mismatch; no automatic pull')
            if info.get('Config', {}).get('Volumes'):
                raise ValueError('Image-declared persistent volumes require separate audited reset')
            images[site['site']] = {'image_id': info['Id'], 'rootfs': info['RootFS'], 'repo_digest': site['image']}
        write_new(self.directory/'creation-intent.json', {**self.identity, 'owner': self.owner, 'manifest_sha256': self.manifest_sha256})
        # Internal bridges can suppress published ports on Docker/Colima. Use
        # a dedicated bridge with ICC disabled and loopback-only publishing.
        # This is NOT an outbound-egress firewall; do not claim that property.
        self.d.run(['network', 'create', '--opt', 'com.docker.network.bridge.enable_icc=false',
                    '--label', 'pss.wav.owner='+self.owner, self.network])
        self.network_owned()
        receipts = []
        for site in self.m['sites']:
            name = self.names[site['site']]
            self.d.run(['run', '-d', '--pull=never', '--name', name, '--label', 'pss.wav.owner='+self.owner,
                        '--platform', 'linux/amd64', '--network', self.network,
                        '-p', '127.0.0.1:%d:80' % site['http_port'], '-p', '127.0.0.1:%d:8877' % site['control_port'],
                        '-e', 'WA_ENV_CTRL_EXTERNAL_SITE_URL=http://127.0.0.1:%d/' % site['http_port'], site['image']])
            info = self.owned(site)
            receipt = {'site': site['site'], 'container_id': info['Id'], 'created_at': info['Created'],
                       'mounts': [], 'image': images[site['site']], **self.await_ready(site)}
            receipts.append(receipt)
        network = self.network_owned()
        evidence = {**self.identity, 'schema': 'pss-wav-full-reset-evidence-v1',
                    'manifest_sha256': self.manifest_sha256, 'source_commit': PIN, 'source_files': source_hashes,
                    'reset_method': 'new-owned-container-from-pinned-image',
                    'writable_state_scope': 'entire fresh image writable layer; no persistent mounts',
                    'sites': receipts, 'network_id': network['Id'], 'network_internal': False,
                    'inter_container_communication':False,'outbound_egress_blocked':False,
                    'no_neighbor_network_members': True, 'confirmed_task_sites': setup['sites'],
                    'confirmatory_authorized': False, 'task_success_claimed': False}
        ref = write_new(self.directory/'reset-evidence.json', evidence)
        return {**self.identity, 'baseline_sha256': self.manifest_sha256, 'restored': True,
                'reset_evidence_ref': ref, 'closure_sites': setup['sites'],
                'isolation_scope': 'new rootfs + no shared mounts + dedicated ICC-disabled bridge + loopback ports',
                'confirmatory_authorized': False}

    def cleanup(self):
        # A failed create can leave an incomplete instance; recover only if the
        # original immutable creation-intent and all extant objects are owned.
        intent = json.loads((self.directory/'creation-intent.json').read_bytes())
        if intent.get('owner') != self.owner or intent.get('manifest_sha256') != self.manifest_sha256:
            raise ValueError('Missing/foreign creation intent; quarantine')
        network = self.network_owned()
        removed = []
        for site in self.m['sites']:
            name = self.names[site['site']]
            if self.d.exists(name):
                info = self.owned(site)
                self.d.run(['rm', '-f', info['Id']])
                if self.d.exists(name):
                    raise ValueError('Owned fixture removal unconfirmed')
                removed.append(info['Id'])
        # network ID, not a broad pattern; reject unexpected members before rm.
        self.network_owned()
        self.d.run(['network', 'rm', network['Id']])
        receipt = {**self.identity, 'cleaned': True, 'removed_owned_container_ids': removed,
                   'removed_owned_network_id': network['Id'], 'confirmatory_authorized': False}
        write_new(self.directory/'cleanup-evidence.json', receipt)
        return receipt


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest', required=True)
    p.add_argument('--manifest-sha256', required=True)
    p.add_argument('--operation', choices=('reset', 'cleanup'), required=True)
    args = p.parse_args()
    manifest = read_ref({'file': args.manifest, 'sha256': args.manifest_sha256})
    payload = json.load(sys.stdin)
    lifecycle = OwnedLifecycle(manifest, args.manifest_sha256, payload)
    try:
        receipt = lifecycle.reset(payload) if args.operation == 'reset' else lifecycle.cleanup()
        print(json.dumps(receipt, allow_nan=False))
    except Exception as exc:
        # Keep the owned instance quarantined for exact-target inspection.
        print(json.dumps({'error_type': type(exc).__name__, 'quarantined': True}), file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == '__main__':
    main()
