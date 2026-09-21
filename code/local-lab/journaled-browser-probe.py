"""Real Chromium actuator tests against hermetic fixtures, no LLM or benchmark."""
import argparse
import base64
import io
import json
from pathlib import Path
import tempfile
from PIL import Image
from playwright.sync_api import sync_playwright
from journaled_browser import Journal, JournaledBrowser, sha


def probe(directory):
    checks=[]
    def check(name, condition):
        checks.append({'name':name,'passed':bool(condition)})
        if not condition:raise AssertionError(name)
    image=io.BytesIO();Image.new('RGB',(8,8),'red').save(image,format='PNG');data=image.getvalue()
    task={'intent':'synthetic actuator test','task_images':[{'sha256':sha(data),'image_url':'data:image/png;base64,'+base64.b64encode(data).decode()}]}
    # Same transformation as the pinned official VWA pil_to_b64, independently
    # preserve original GIF bytes for uploads. A .png suffix is not a MIME type.
    gif=io.BytesIO();Image.new('RGB',(8,8),'red').save(gif,format='GIF')
    gif_file=Path(directory)/'misnamed.png';gif_file.write_bytes(gif.getvalue())
    from runtime_inputs import materialize_actor_input
    projected=materialize_actor_input({'task_images':[{'file':str(gif_file),'sha256':sha(gif.getvalue()),'mime_type':'image/gif'}]})
    expected=io.BytesIO();Image.open(io.BytesIO(gif.getvalue())).save(expected,format='PNG')
    check('vwa-gif-view-encoding-parity',base64.b64decode(projected['task_images'][0]['image_url'].split(',')[1])==expected.getvalue())
    check('gif-upload-original-bytes',base64.b64decode(projected['task_images'][0]['upload_url'].split(',')[1])==gif.getvalue())
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={'width':800,'height':600},device_scale_factor=1)
        context.route('**/*',lambda route:route.fulfill(status=200,content_type='text/html',body='<h1>Second page</h1>'))
        page=context.new_page()
        page.set_content('''<body style="margin:0"><input type=file style="position:absolute;left:20px;top:20px;width:240px;height:40px" onchange="window.uploaded=this.files[0].name">
        <button style="position:absolute;left:20px;top:100px;width:200px;height:60px" onclick="window.open('http://fixture.test/next')">Open next</button>
        <button style="position:absolute;left:300px;top:100px" aria-label="FORBIDDEN_ARIA">VISIBLE</button>
        <button style="display:none">FORBIDDEN_HIDDEN</button><div style="opacity:0"><button>FORBIDDEN_ALPHA</button></div>
        <input type=password value="FORBIDDEN_PASSWORD"><button style="position:absolute;top:4000px">FORBIDDEN_OFFSCREEN</button></body>''')
        j=Journal(Path(directory)/'trajectory');act=JournaledBrowser(context,page,j,[800,600],task,settle_ms=50)
        raw=act.observe('visual');check('pixel-only-return',set(raw)=={'screenshot','action_error'})
        raw=act.observe('hybrid');check('hidden-text-not-projected','FORBIDDEN' not in json.dumps(raw['visible_controls']))
        check('visible-text-preserved','VISIBLE' in json.dumps(raw['visible_controls']))
        act.execute({'name':'upload','x':50,'y':40,'asset_id':'task-image-0'})
        check('native-file-chooser',page.evaluate('window.uploaded')=='task-image-0.png')
        check('exact-image-size',page.locator('input[type=file]').evaluate('(e)=>e.files[0].size')==len(data))
        act.execute({'name':'click','x':80,'y':130});page.wait_for_timeout(200)
        check('popup-focus-without-url-branch',act.page is not page and len(act.pages)==2)
        act.observe('visual')
        act.execute({'name':'tab_focus','index':0});check('explicit-tab-focus',act.page is page)
        act.execute({'name':'tab_focus','index':63});check('unknown-tab-generic-error',act.action_error=='target-unavailable')
        act.execute({'name':'tab_focus','index':1});act.execute({'name':'tab_close'});check('close-restores-surviving-page',act.page is page)
        page.set_content('<iframe src="http://fixture.test/frame"></iframe>')
        try:act.observe('hybrid')
        except Exception:check('unaudited-frame-projection-rejected',True)
        else:check('unaudited-frame-projection-rejected',False)
        lines=(j.directory/'trajectory.jsonl').read_bytes().splitlines()
        check('hash-chain',all(json.loads(lines[i])['previous_sha256']==sha(lines[i-1]) for i in range(1,len(lines))))
        check('screenshots-persisted',len(list(j.directory.glob('frame-*.png')))>=3)
        browser.close()
    return {'kind':'SYNTHETIC_CHROMIUM_ACTUATOR_PROBE','model_requests':0,'benchmark_executions':0,
            'confirmatory_authorized':False,'checks':checks,'passed':all(x['passed'] for x in checks)}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
    d=Path(a.output);d.mkdir(parents=True,exist_ok=False,mode=0o700)
    report=probe(d);(d/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
