"""Outcome-free official task envelope. Hashes bind bytes, not authority claims.

Only the trusted importer reads official source and evaluator material. The
actor receives a nested allowlist; task image bytes are pinned before execution.
This validates a projection, not whether a human has screened the official task.
"""
import base64
import hashlib
import json
from pathlib import Path
from runtime_store import digest


def read_pinned(filename, expected):
    if not isinstance(expected, str) or len(expected) != 64:
        raise ValueError('Pinned file SHA256 required')
    raw = Path(filename).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Pinned file source drift')
    return raw


def exact_keys(value, allowed, required=()):
    if not isinstance(value, dict) or set(value) - set(allowed) or set(required) - set(value):
        raise ValueError('Unexpected/missing task input fields; no evaluator metadata allowed')


def task_projection(envelope, benchmark):
    exact_keys(envelope, ('schema', 'benchmark', 'intent', 'steps', 'task_images'),
               ('schema', 'benchmark', 'intent', 'task_images'))
    if envelope['schema'] != 'pss-official-task-input-v1' or envelope['benchmark'] != benchmark:
        raise ValueError('Task envelope benchmark/schema mismatch')
    if not isinstance(envelope['intent'], str) or not envelope['intent'].strip():
        raise ValueError('Nonempty official intent required')
    result = {'intent': envelope['intent']}
    if benchmark == 'ata':
        steps = envelope.get('steps')
        if not isinstance(steps, list) or not steps:
            raise ValueError('ATA public steps and assertions required')
        seen = set()
        for step in steps:
            exact_keys(step, ('step', 'action', 'expectedResult'), ('step', 'action', 'expectedResult'))
            if type(step['step']) is not int or step['step'] < 1 or step['step'] in seen:
                raise ValueError('Unique positive official step indices required')
            if not all(isinstance(step[k], str) for k in ('action', 'expectedResult')):
                raise ValueError('Public step text required')
            seen.add(step['step'])
        result['steps'] = steps
    elif benchmark not in ('wav', 'vwa') or 'steps' in envelope:
        raise ValueError('Unexpected benchmark/steps')
    if not isinstance(envelope['task_images'], list):
        raise ValueError('Explicit task image list required (empty when absent upstream)')
    images = []
    for attachment in envelope['task_images']:
        exact_keys(attachment, ('file', 'sha256', 'mime_type'), ('file', 'sha256', 'mime_type'))
        if attachment['mime_type'] not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif'):
            raise ValueError('Supported pinned task image required')
        data = read_pinned(attachment['file'], attachment['sha256'])
        signatures = {'image/png': data.startswith(b'\x89PNG\r\n\x1a\n'),
                      'image/jpeg': data.startswith(b'\xff\xd8\xff'),
                      'image/webp': data[:4] == b'RIFF' and data[8:12] == b'WEBP',
                      'image/gif': data[:6] in (b'GIF87a',b'GIF89a')}
        if not signatures[attachment['mime_type']]:
            raise ValueError('Task image content/type mismatch')
        # Keep one immutable image artifact instead of repeating base64 in every
        # scheduled row/SQLite record. Paths are removed before actor delivery.
        images.append(dict(attachment))
    result['task_images'] = images
    return result


def materialize_actor_input(payload):
    result = dict(payload)
    if 'task_images' not in result:
        return result  # historical synthetic ledger fixtures
    images = []
    for attachment in result['task_images']:
        data = read_pinned(attachment['file'], attachment['sha256'])
        upload_uri='data:' + attachment['mime_type'] + ';base64,' + base64.b64encode(data).decode()
        image={'sha256':attachment['sha256'],'image_url':upload_uri}
        if attachment['mime_type']=='image/gif':
            # Pinned VWA run.py opens the image with PIL; browser_env/utils.py
            # pil_to_b64 saves the current (initial) frame as PNG. Preserve the
            # original file independently for upload instead of changing bytes.
            import io
            from PIL import Image
            with Image.open(io.BytesIO(data)) as original:
                stream=io.BytesIO();original.save(stream,format='PNG');model_bytes=stream.getvalue()
            image.update(image_url='data:image/png;base64,'+base64.b64encode(model_bytes).decode(),
                         upload_url=upload_uri,model_image_sha256=hashlib.sha256(model_bytes).hexdigest(),
                         image_encoding='vwa-pil-initial-frame-to-png')
        images.append(image)
    result['task_images'] = images
    return result


def verify_bound_input(op):
    evidence = op.get('task_input_binding')
    if not evidence:
        if op.get('scope') == 'synthetic':
            return  # Legacy ledger fixtures only; never official diagnostic work.
        raise ValueError('Missing frozen task input correspondence')
    for field in ('task_key', 'benchmark', 'schedule_sha256'):
        if evidence.get(field) != op.get(field):
            raise ValueError('Bound task identity mismatch')
    if evidence.get('agent_payload_sha256') != digest(op.get('agent_input')):
        raise ValueError('Bound actor input drift')
    if evidence.get('evaluation_ref_sha256') != digest(op.get('evaluation_ref')):
        raise ValueError('Bound evaluator reference drift')
    ref = op['evaluation_ref']
    read_pinned(ref['file'], ref['sha256'])
    if 'setup_ref' in op:
        if digest(op['setup_ref'])!=op.get('setup_binding_sha256'):
            raise ValueError('Bound environment setup drift')
        read_pinned(op['setup_ref']['file'],op['setup_ref']['sha256'])
