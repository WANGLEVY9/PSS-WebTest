"""Durable, single-attempt model transport for real framework components.

No provider fallback, prompt repair or answer repair. The lease/model binding and
campaign reservation are checked before every network attempt. Unknown billing
stays unknown and consumes the full reservation; never reported as zero cost.
"""
import base64
import copy
import json
import os
from pathlib import Path
import subprocess
import time
import uuid
from runtime_store import Store
from journaled_browser import sha


class ProviderFailure(RuntimeError):
    pass


class ModelOutputValidationError(ValueError):
    """A delivered provider response violates the framework action schema."""


def validate_model_json(output_format, raw):
    try:
        return output_format.model_validate_json(raw)
    except ValueError as exc:
        raise ModelOutputValidationError('browser-use-schema-validation') from exc


def single_action_schema(output_format):
    """Advertise the same one-action boundary enforced after parsing.

    The upstream Browser Use model uses an unconstrained action list. A model
    can therefore return [] even though our actuator cannot execute it. This
    changes only the output contract, not the observations or action set.
    """
    schema = copy.deepcopy(output_format.model_json_schema())
    action = schema.get('properties', {}).get('action')
    if not isinstance(action, dict) or action.get('type') != 'array':
        raise ModelOutputValidationError('browser-use-action-schema-missing')
    action.pop('min_items', None)  # Upstream emits this nonstandard spelling.
    action['minItems'] = action['maxItems'] = 1
    return schema


def evidence_projection(value, journal):
    if isinstance(value, str) and value.startswith('data:image/') and ';base64,' in value:
        prefix, raw = value.split(',', 1)
        data = base64.b64decode(raw, validate=True)
        extension = {'data:image/png;base64':'png', 'data:image/jpeg;base64':'jpg', 'data:image/webp;base64':'webp'}[prefix]
        name = 'image-'+sha(data)+'.'+extension
        filename = journal.directory/name
        if filename.exists():
            if sha(filename.read_bytes()) != sha(data): raise ValueError('Image evidence drift')
            artifact = {'file':name, 'sha256':sha(data), 'bytes':len(data)}
        else: artifact = journal.artifact(name, data)
        return {'image_artifact':artifact, 'mime_type':prefix[5:].split(';')[0]}
    if isinstance(value, list): return [evidence_projection(v, journal) for v in value]
    if isinstance(value, dict): return {k:evidence_projection(v, journal) for k,v in value.items()}
    return value


class LedgerModel:
    def __init__(self, payload, journal, node, deadline, request_timeout_ms=30000):
        self.payload, self.journal, self.node = payload, journal, node
        self.deadline, self.request_timeout_ms = deadline, request_timeout_ms
        self.identity = payload['model_binding']
        self.requests = 0
        self.last = {}
        self.bridge = Path(__file__).with_name('framework-provider-bridge.mjs')

    def request(self, messages, schema=None):
        timeout = min(self.request_timeout_ms, int((self.deadline-time.monotonic())*1000))
        if timeout <= 0: raise TimeoutError('Task budget exhausted before model request')
        ledger = self.payload['request_ledger']
        store = Store(ledger['database'])
        request_id = str(uuid.uuid4())
        try:
            store.heartbeat(ledger['opportunityId'], ledger['leaseToken'])
            store.reserve(ledger['opportunityId'], ledger['leaseToken'], request_id, self.identity,
                          self.payload['cost_policy']['request_reservation_micro_usd'], ledger['capMicroUsd'])
            self.requests += 1
            request = {**self.identity, 'messages':messages, 'schema':schema, 'timeout_ms':timeout,
                       'spend_task_id':ledger['opportunityId'], 'runtime_request_id':request_id}
            ref = self.journal.artifact(f'request-{self.requests:04d}.json',
                json.dumps(evidence_projection(request, self.journal), ensure_ascii=False).encode())
            self.journal.event('provider-start', request_id=request_id, request=ref)
            started = time.monotonic()
            # Keys are inherited/read locally by the transport, not sent in argv,
            # stored in journal, or exposed to a model. stderr never echoed.
            p = subprocess.Popen([self.node, str(self.bridge)], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            first = True
            result = None
            try:
                while True:
                    left = timeout/1000 + 2 - (time.monotonic()-started)
                    if left <= 0: raise subprocess.TimeoutExpired(p.args, timeout/1000)
                    try:
                        output, _ = p.communicate(json.dumps(request) if first else None, timeout=min(5,left))
                        result = json.loads(output)
                        break
                    except subprocess.TimeoutExpired:
                        first = False
                        store.heartbeat(ledger['opportunityId'], ledger['leaseToken'])
            except (subprocess.TimeoutExpired, json.JSONDecodeError):
                result = {'failure_class':'provider-transport-unresolved', 'output':None, 'usage':None}
            finally:
                if p.poll() is None: p.kill()
                p.communicate()
            self.last = result
            summary = {k:v for k,v in result.items() if k not in ('output','raw_output')}
            store.settle(request_id, summary, None)
            response = self.journal.artifact(f'response-{self.requests:04d}.json', json.dumps(result).encode())
            self.journal.event('provider-end', request_id=request_id, response=response,
                               summary=summary, elapsed_ms=(time.monotonic()-started)*1000)
            if result.get('failure_class'): raise ProviderFailure(result['failure_class'])
            return result['output']
        finally:
            store.close()

    def get_stats(self):
        return {'provider_attempts':self.requests, 'usage':self.last.get('usage')}

    def __call__(self, messages):
        return {'role':'assistant', 'content':self.request(messages.to_openai())}


def agentlab_args(model):
    from dataclasses import dataclass
    from agentlab.llm.base_api import BaseModelArgs
    @dataclass
    class Args(BaseModelArgs):
        def make_model(self): return model
    return Args(model_name=model.identity['model'], vision_support=True)


def browser_use_model(backend):
    from browser_use.llm.openai.serializer import OpenAIMessageSerializer
    from browser_use.llm.views import ChatInvokeCompletion
    class Model:
        model = model_name = name = backend.identity['model']
        provider = 'openai'
        _verified_api_keys = True
        async def ainvoke(self, messages, output_format=None, **kwargs):
            # The caller awaits one decision outside the synchronous Playwright
            # loop. No Browser Use SDK retries or hidden provider routes.
            serialized = OpenAIMessageSerializer.serialize_messages(messages)
            schema = single_action_schema(output_format)
            serialized.insert(0, {'role':'system', 'content':'Return exactly one JSON object, never an array. Follow this action schema: '+json.dumps(schema)})
            raw = backend.request(serialized, schema)
            parsed = validate_model_json(output_format, raw)
            return ChatInvokeCompletion(completion=parsed, usage=None)
    return Model()
