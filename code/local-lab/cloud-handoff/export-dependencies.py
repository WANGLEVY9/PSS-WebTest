"""Export declared dependencies; never install, resolve, or assert Linux readiness."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vwa-source', required=True)
    parser.add_argument('--output', required=True, help='New output directory')
    args = parser.parse_args()
    code = Path(__file__).resolve().parents[2]
    vwa = Path(args.vwa_source).resolve()
    source_manifest = json.loads((code/'config/benchmark-artifact-manifest.v1.0.json').read_text())
    sources = [{k: s[k] for k in ('id', 'repository', 'source_commit')} for s in source_manifest['mandatory_core']]
    pin = next(s['source_commit'] for s in sources if s['id'] == 'visualwebarena')
    head = subprocess.check_output(['git', '-C', str(vwa), 'rev-parse', 'HEAD'], text=True).strip()
    if head != pin:
        raise ValueError('VWA checkout differs from the declared source pin')
    raw_vwa = subprocess.check_output(['git', '-C', str(vwa), 'show', f'{pin}:requirements.txt'])
    if (vwa/'requirements.txt').read_bytes() != raw_vwa:
        raise ValueError('VWA requirements changed from pinned source')
    rows, inputs = [], []
    for group, relative, raw in [
        ('wav-local-macos-candidate', 'config/frameworks/wav-local-macos-arm64-py312.lock', (code/'config/frameworks/wav-local-macos-arm64-py312.lock').read_bytes()),
        ('agentlab-candidate', 'config/frameworks/h-agentlab.lock', (code/'config/frameworks/h-agentlab.lock').read_bytes()),
        ('browser-use-journaled-actuator-candidate', 'config/frameworks/h-browser-use-journaled-actuator.lock', (code/'config/frameworks/h-browser-use-journaled-actuator.lock').read_bytes()),
        ('vwa-upstream-declared', 'visualwebarena/requirements.txt', raw_vwa),
    ]:
        digest = hashlib.sha256(raw).hexdigest()
        inputs.append({'group': group, 'source': relative, 'sha256': digest})
        for line in raw.decode().splitlines():
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            name, separator, version = line.partition('==')
            if not separator:
                raise ValueError('Non-exact dependency declaration; review required')
            rows.append([group, 'python', name, version, relative, digest,
                         'MACOS_ONLY_BLOCKER' if name.startswith('pyobjc') else 'DECLARED_NOT_LINUX_VERIFIED'])
    npm_raw = (code/'package-lock.json').read_bytes()
    npm_sha = hashlib.sha256(npm_raw).hexdigest()
    inputs.append({'group': 'node', 'source': 'package-lock.json', 'sha256': npm_sha})
    for package_path, package in json.loads(npm_raw)['packages'].items():
        if not package_path:
            continue
        rows.append(['node', 'npm', package_path, package.get('version', 'UNSPECIFIED'),
                     'package-lock.json', npm_sha, 'LOCKED_NOT_CLOUD_INSTALL_VERIFIED'])
    output = Path(args.output)
    output.mkdir(mode=0o700)
    with (output/'dependency-packages.csv').open('x', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(['environment', 'ecosystem', 'package', 'declared_version', 'source_file', 'source_sha256', 'verification'])
        writer.writerows(rows)
    manifest = {
        'schema': 'pss-cloud-dependencies-v1', 'inventory_kind': 'DECLARED_DEPENDENCIES_NOT_INSTALL_LOCK',
        'confirmatory_authorized': False, 'cloud_install_verified': False,
        'scientific_authority': 'config/active-study-design.json',
        'corrected_ata_population': {'tasks': 113, 'pass': 62, 'fail': 51},
        'sources': sources, 'dependency_inputs': inputs, 'package_rows': len(rows),
        'inventory_sha256': hashlib.sha256((output/'dependency-packages.csv').read_bytes()).hexdigest(),
        'runtime_requirements': {
            'os': 'native Linux x86_64', 'node': '>=20, exact version to freeze',
            'vwa_python': '3.10 or 3.11; not 3.12', 'wav_python': '>=3.11; exact environment to freeze',
            'framework_python_candidate': '3.12; Linux installation unverified',
            'docker': 'Engine plus Compose v2; exact versions to freeze',
            'storage': 'local block storage for SQLite; measure actual DockerRootDir',
            'gpu': 'depends on verified evaluator/captioning model; not inferred from remote actor API'},
        'vwa_assets': [
            {'id': 'shopping', 'asset': 'shopping_final_0712.tar', 'port': 7770},
            {'id': 'reddit', 'asset': 'postmill-populated-exposed-withimg.tar', 'port': 9999},
            {'id': 'classifieds', 'asset': 'classifieds image + MySQL + pinned SQL', 'port': 9980},
            {'id': 'wikipedia', 'asset': 'wikipedia_en_all_maxi_2022-05.zim + Kiwix', 'port': 8888},
            {'id': 'homepage', 'asset': 'environment_docker/webarena-homepage + reviewed Flask environment', 'port': 4399}],
        'wav_sites': [
            {'id': name, 'web_port': web, 'control_port': ctrl, 'verified_release_image_digest': None}
            for name, web, ctrl in [('shopping',7770,7771), ('shopping_admin',7780,7781),
                ('reddit',9999,9998), ('gitlab',8023,8024), ('wikipedia',8888,8889), ('map',3030,3031)]],
        'ata': {'publication': 'https://doi.org/10.5281/zenodo.15198569',
            'archive_sha256': 'c0b0a21f3ca5871f8c6db59e7d015e04350c577aef8714091e40246dc8fcb3bf',
            'csv_hash_manifest': 'config/ata-source-population.v1.json',
            'applications': {'classifieds':30, 'onestopshop':49, 'postmill':34},
            'runtime_baseline_mapping_verified': False},
        'asset_metadata_required_before_start': ['download_url', 'bytes', 'sha256', 'expected_digest_source',
            'image_architecture', 'local_image_id', 'registry_digest_if_available', 'license', 'baseline_state_hash'],
        'additional_dependencies_to_freeze': ['WAV complete Linux dependency lock', 'ATA publication ZIP and six CSV digests',
            'framework Linux locks without platform-incompatible packages', 'per-environment browser revisions and OS libraries',
            'task input images', 'authentication state', 'captioning/evaluation weights and revisions',
            'private reset credentials', 'reviewed per-arm lifecycle executors', 'shared provider pricing and request guard'],
        'unmeasured': {'download_bytes': None, 'expanded_image_bytes': None, 'minimum_host_ram_bytes': None,
            'peak_install_disk_bytes': None, 'per_worker_peak_ram_bytes': None, 'minimum_gpu_vram_bytes': None},
    }
    (output/'dependency-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({'output': str(output), 'package_rows': len(rows), 'cloud_install_verified': False}))


if __name__ == '__main__':
    main()
