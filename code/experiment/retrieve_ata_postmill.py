"""Bounded retrieval of the original upstream ATA/VWA Postmill Docker archive.

No image import, VM changes or benchmark execution. The official VWA README
links this mirror. Archive metadata supplies a SHA1; also compute local SHA256.
Partial/failed downloads are preserved, never represented as verified images.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from wav_owned_lifecycle import write_new

URL='https://archive.org/download/postmill-populated-exposed-withimg/postmill-populated-exposed-withimg.tar'
SIZE=53435097088
SHA1='c19eaed0886a008fe51370b36b22f61ed49f6392'


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);p.add_argument('--download',action='store_true');a=p.parse_args()
    if not a.download:print('No download: --download required');return
    root=Path(a.output).resolve();root.parent.mkdir(parents=True,exist_ok=True)
    if shutil.disk_usage(root.parent).free<2*SIZE+20*1024**3:
        raise ValueError('Host archive plus workspace reserve unavailable')
    root.mkdir(mode=0o700,exist_ok=False)
    write_new(root/'retrieval-intent.json',{'url':URL,'expected_bytes':SIZE,'upstream_sha1':SHA1,
        'metadata_source':'https://archive.org/metadata/postmill-populated-exposed-withimg',
        'rate_cap':'8 MiB/s','maximum_seconds':14400,'image_import_authorized_by_this_script':False,
        'benchmark_executions':0,'confirmatory_authorized':False})
    partial=root/'postmill.tar.part'
    print(json.dumps({'stage':'downloading-original-ata-postmill','expected_bytes':SIZE}),flush=True)
    result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','14400',
         '--speed-limit','16384','--speed-time','120','--limit-rate','8M','--max-filesize',str(SIZE),
         '--output',str(partial),URL],capture_output=True,text=True)
    report={'kind':'ATA_ORIGINAL_IMAGE_RETRIEVAL','url':URL,'exit_code':result.returncode,
        'expected_bytes':SIZE,'actual_bytes':partial.stat().st_size if partial.exists() else 0,
        'upstream_sha1':SHA1,'verified':False,'image_loaded':False,'benchmark_executions':0,'confirmatory_authorized':False}
    if result.returncode==0 and report['actual_bytes']==SIZE:
        h1=hashlib.sha1();h256=hashlib.sha256()
        with partial.open('rb') as stream:
            for chunk in iter(lambda:stream.read(16*1024**2),b''):h1.update(chunk);h256.update(chunk)
        report.update(actual_sha1=h1.hexdigest(),sha256=h256.hexdigest(),verified=h1.hexdigest()==SHA1)
        if report['verified']:partial.rename(root/'postmill-populated-exposed-withimg.tar')
    write_new(root/'retrieval-report.json',report)
    print(json.dumps(report),flush=True)
    if not report['verified']:raise SystemExit(2)


if __name__=='__main__':main()
