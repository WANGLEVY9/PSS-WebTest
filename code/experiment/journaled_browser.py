"""Boundary-preserving actuator and private append-only trajectory journal.

Used inside an already reset benchmark context. This module DOES NOT reset a SUT,
evaluate a task, admit a benchmark or mark the model's done claim as successful.
Private URL/trace data is written for evaluator/replay only and never returned in
the actor observation or used for progress/termination decisions.
"""
import base64
import hashlib
import json
import os
import math
from pathlib import Path
import time
from framework_actions import validate


def sha(data):
    return hashlib.sha256(data).hexdigest()


class Journal:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=False)
        self.sequence = 0
        self.previous = None

    def artifact(self, name, data):
        if Path(name).name != name:
            raise ValueError('Flat artifact names required')
        fd = os.open(self.directory/name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        return {'file': name, 'sha256': sha(data), 'bytes': len(data)}

    def event(self, kind, **payload):
        row = {'sequence': self.sequence, 'at_unix': time.time(), 'kind': kind,
               'previous_sha256': self.previous, **payload}
        encoded = json.dumps(row, sort_keys=True, allow_nan=False).encode()
        fd = os.open(self.directory/'trajectory.jsonl', os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, 'ab') as stream:
            stream.write(encoded+b'\n'); stream.flush(); os.fsync(stream.fileno())
        self.previous = sha(encoded)
        self.sequence += 1
        return row


# Conservative visible projection. Hidden aria-label/labelledby/alt text is not
# copied: names come from rendered text. Unsupported visible frames/shadow roots
# fail closed for hybrid until a separately audited producer is implemented.
VISIBLE_PROJECTION = r"""() => {
 const visible = e => {const r=e.getBoundingClientRect(),s=getComputedStyle(e);
   for(let p=e;p;p=p.parentElement)if(Number(getComputedStyle(p).opacity)===0)return false;
   return r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0;};
 if ([...document.querySelectorAll('iframe,frame')].some(visible) ||
     [...document.querySelectorAll('*')].some(e=>e.shadowRoot&&visible(e)))
   throw new Error('Unsupported visible frame/shadow projection');
 const renderedText=e=>{let out=[]; const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()) {if(!visible(n.parentElement))continue;
     const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();
     if(r.width<=0||r.height<=0||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)continue;
     const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
     if(hit&&(n.parentElement===hit||n.parentElement.contains(hit)))out.push(n.textContent);}
   return out.join(' ').replace(/\s+/g,' ').trim().slice(0,500);};
 const result=[];
 for(const e of document.querySelectorAll('button,a[href],input,textarea,select,[role],summary,[contenteditable=true]')) {
   if(!visible(e)||e.matches('input[type=hidden]'))continue;
   const r=e.getBoundingClientRect(),x=Math.max(0,r.left),y=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
   const hit=document.elementFromPoint((x+right)/2,(y+bottom)/2);if(!hit||!(e===hit||e.contains(hit)))continue;
   const type=e.type||'', tag=e.tagName.toLowerCase();
   const role=e.getAttribute('role')||({button:'button',a:'link',textarea:'textbox',select:'combobox',summary:'button'}[tag])||
     (tag==='input'?(type==='checkbox'?'checkbox':type==='radio'?'radio':['submit','button','file'].includes(type)?'button':'textbox'):'generic');
   let name=renderedText(e);if(!name&&e.labels)name=[...e.labels].map(renderedText).filter(Boolean).join(' ');
   let value='';if(['input','textarea'].includes(tag)&&!['password','hidden','file','checkbox','radio'].includes(type)&&e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight)value=String(e.value||'').slice(0,500);
   if(tag==='input'&&['submit','button'].includes(type))name=value;
   if(tag==='select')value=Array.from(e.selectedOptions).map(o=>o.textContent).join(' ').slice(0,500);
   const state=[e.disabled?'disabled':'', ['checkbox','radio'].includes(type)?(e.checked?'checked':'unchecked'):''].filter(Boolean).join(' ');
   result.push({role,name,value,state,box:[x,y,right-x,bottom-y],visible:true,in_viewport:true});
 }
 return result;
}"""


def screenshot_stall_signal(previous_sha, current_png, last_action, enabled):
    """Return only an exact pixel-derived no-change signal, never page state."""
    if type(enabled) is not bool:
        raise ValueError('Explicit screenshot feedback setting required')
    if not enabled or previous_sha is None or last_action not in {
            'click', 'double_click', 'type', 'key', 'scroll', 'upload',
            'tab_focus', 'tab_close', 'back', 'forward'}:
        return None
    return 'unchanged' if previous_sha == sha(current_png) else None


class JournaledBrowser:
    def __init__(self, context, page, journal, viewport, task, action_timeout_ms=5000, settle_ms=750,
                 observation_timeout_ms=5000, screenshot_stall_feedback=False):
        self.context, self.page, self.journal = context, page, journal
        self.viewport = list(viewport)
        self.timeout, self.settle_ms = action_timeout_ms, settle_ms
        if type(observation_timeout_ms) is not int or observation_timeout_ms <= 0:
            raise ValueError('Positive observation timeout required')
        self.observation_timeout = observation_timeout_ms
        self.pages = list(context.pages)
        self.action_error = None
        if type(screenshot_stall_feedback) is not bool:
            raise ValueError('Boolean screenshot stall feedback setting required')
        self.screenshot_stall_feedback = screenshot_stall_feedback
        self.previous_frame_sha = None
        self.last_action = None
        self.assets = {}
        self.deadline = float('inf')
        for index, image in enumerate(task.get('task_images', [])):
            prefix, encoded = image.get('upload_url',image['image_url']).split(',', 1)
            mime = prefix.removeprefix('data:').removesuffix(';base64')
            if mime not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif') or not prefix.endswith(';base64'):
                raise ValueError('Pinned image type required')
            data = base64.b64decode(encoded, validate=True)
            if sha(data) != image['sha256']:
                raise ValueError('Task image drift')
            extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mime]
            self.assets[f'task-image-{index}'] = {'name':f'task-image-{index}.{extension}', 'mimeType':mime, 'buffer':data}
        context.on('page', self._opened)
        for existing in self.pages:
            existing.on('dialog', lambda d: d.dismiss())

    def _opened(self, page):
        self.pages.append(page)
        page.on('dialog', lambda d: d.dismiss())
        # Native popup creation changes browser focus; no URL/title/DOM decision.
        self.page = page
        self.journal.event('page-opened', page_ordinal=len(self.pages)-1)

    def remaining_ms(self, maximum=None):
        maximum = self.timeout if maximum is None else maximum
        if math.isinf(self.deadline):
            return maximum
        return max(1, min(maximum, int((self.deadline-time.monotonic())*1000)))

    def screenshot(self, phase):
        try:
            return self.page.screenshot(type='png',timeout=self.remaining_ms(self.observation_timeout))
        except Exception as exc:
            # Private call log is evidence only, never feedback to the model.
            ref=self.journal.artifact(f'observation-error-{self.journal.sequence:06d}.txt',str(exc).encode())
            self.journal.event('observation-error',phase=phase,error_type=type(exc).__name__,private_detail_ref=ref)
            raise

    def observe(self, mode):
        # Reacquire a complete matched observation, never reuse old controls.
        # Every failed pair is retained. This is bounded image acquisition, not
        # a new task attempt or model retry; all time consumes the actor budget.
        for attempt in range(3):
            try:
                return self._observe_pair(mode)
            except ProjectionDrift:
                self.journal.event('observation-reacquire',attempt=attempt+1,limit=3)
                if attempt==2:
                    raise

    def _observe_pair(self, mode):
        if mode not in ('visual', 'hybrid'):
            raise ValueError('Explicit mode required')
        if time.monotonic() >= self.deadline:
            raise TimeoutError('Task deadline')
        # Fixed dwell only. No DOM/URL/load-state based progress or done heuristic.
        self.page.wait_for_timeout(min(self.settle_ms, self.remaining_ms()))
        png = self.screenshot('primary-frame')
        visual_feedback = screenshot_stall_signal(self.previous_frame_sha, png,
                                                  self.last_action, self.screenshot_stall_feedback)
        frame = self.journal.artifact(f'frame-{self.journal.sequence:06d}.png', png)
        self.journal.event('observation', frame=frame, page_ordinal=self.pages.index(self.page),
                           private_url=self.page.url, action_error=self.action_error, mode=mode,
                           visual_feedback=visual_feedback)
        result = {'screenshot': png, 'action_error': self.action_error,
                  'visual_feedback': visual_feedback}
        if mode == 'hybrid':
            controls = self.page.evaluate(VISIBLE_PROJECTION)
            after=self.screenshot('projection-bracket')
            ref=self.journal.artifact(f'bracket-{self.journal.sequence:06d}.png',after)
            self.journal.event('projection-bracket',frame=ref,unchanged=sha(after)==sha(png))
            if sha(after)!=sha(png):
                raise ProjectionDrift('Screenshot changed during projection; no stale controls dispatched')
            result['visible_controls'] = controls
            self.journal.event('hybrid-projection', controls=controls, frame_sha256=frame['sha256'])
        self.previous_frame_sha = sha(png)
        self.last_action = None
        return result

    def execute(self, action):
        validate(action, self.viewport, self.assets)
        if time.monotonic() >= self.deadline:
            raise TimeoutError('Task deadline')
        self.action_error = None
        before = self.page
        began = time.monotonic()
        self.journal.event('action-start', action=action)
        name = action['name']
        try:
            if name in ('click', 'double_click', 'move'):
                getattr(self.page.mouse, {'click':'click','double_click':'dblclick','move':'move'}[name])(action['x'], action['y'])
            elif name == 'type': self.page.keyboard.type(action['text'])
            elif name == 'key': self.page.keyboard.press(action['key'])
            elif name == 'scroll':
                self.page.mouse.move(action['x'], action['y'])
                self.page.mouse.wheel(action['dx'], action['dy'])
            elif name == 'upload':
                # Only a coordinate-triggered native chooser; never query/set a
                # hidden file input or let the model name an on-disk path.
                with self.page.expect_file_chooser(timeout=self.remaining_ms()) as event:
                    self.page.mouse.click(action['x'], action['y'])
                event.value.set_files(self.assets[action['asset_id']], timeout=self.remaining_ms())
            elif name == 'tab_focus':
                index = action['index']
                if index >= len(self.pages) or self.pages[index].is_closed():
                    self.action_error = 'target-unavailable'
                else:
                    self.page = self.pages[index]; self.page.bring_to_front()
            elif name == 'tab_close':
                if len([p for p in self.pages if not p.is_closed()]) <= 1:
                    self.action_error = 'action-rejected'
                else:
                    self.page.close()
                    self.page = next(p for p in reversed(self.pages) if not p.is_closed())
            elif name in ('back', 'forward'):
                getattr(self.page, 'go_'+name)(wait_until='commit', timeout=self.remaining_ms())
            elif name == 'wait': self.page.wait_for_timeout(min(500, self.remaining_ms()))
            # done is recorded only; no oracle lookup or automatic success.
        except Exception as exc:
            self.action_error = 'action-timeout' if type(exc).__name__ == 'TimeoutError' else 'browser-error'
            self.journal.event('action-exception', error_type=type(exc).__name__)
        self.journal.event('action-end', action=action, action_error=self.action_error,
                           elapsed_ms=(time.monotonic()-began)*1000,
                           page_ordinal=self.pages.index(self.page), private_url=self.page.url,
                           previous_page_closed=before.is_closed())
        self.last_action = name if self.action_error is None else None
        return self.action_error


class ProjectionDrift(RuntimeError):
    pass
