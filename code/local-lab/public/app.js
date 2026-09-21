const $=id=>document.getElementById(id);let state,selected=null;const positions=new Map();let last=null;
const labels={visual:['Pure visual','截图 → 坐标 / 键盘动作'],hybrid:['Hybrid agent','截图 + 可见结构 → 动作'],playwright:['Playwright','可访问性 locator → 确定性脚本']};
const statusNames={queued:'等待执行',resetting:'独立重置',running:'正在执行',passed:'严格通过',failed:'未通过',unresolved:'未决',completed:'批次已结束',interrupted:'运行中断'};
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function addLink(parent,label,url){const a=node('a',label);a.href=url;parent.append(a);}
function metric(title,value,note){const el=node('div',undefined,'metric');el.append(node('label',title),node('strong',value),node('small',note));return el;}
function render(){
  const b=state.batches.find(b=>b.id===selected)||state.batches[0];selected=b?.id||null;
  const select=$('batch');select.replaceChildren(...(state.batches.length?state.batches.map(b=>{const o=node('option',b.id);o.value=b.id;return o;}):[node('option','暂无批次，点击右上角启动')]));if(selected)select.value=selected;
  $('model').textContent=`${b?.model||state.model||'未配置'} · ${state.configured?'密钥已配置':'缺少密钥'}`;
  $('benchmark').textContent=`公开 benchmark 门禁：WebArena Shopping ${state.benchmark?.ready?'镜像 / 架构 / 服务健康通过':'尚未通过'}。正式 reset / evaluator / 任务准入仍待验证；VWA 与 ATA 未在本轮运行。`;
  $('start').disabled=Boolean(state.active)||!state.configured;$('start').textContent=state.active?'实验执行中…':'启动三策略最小实验 ↗';
  $('batch-status').textContent=statusNames[b?.status]||'未运行';$('exports').replaceChildren();
  if(b){addLink($('exports'),'JSON',`/artifacts/${b.id}/snapshot.json`);addLink($('exports'),'JSONL',`/artifacts/${b.id}/events.jsonl`);$('intent').textContent=b.intent;}
  const rows=b?.records||[],finished=rows.filter(r=>r.finished_at).length,passed=rows.filter(r=>r.strict_pass).length;
  const tokens=rows.flatMap(r=>r.requests||[]).reduce((s,q)=>s+(q.usage?.total_tokens||0),0);
  $('metrics').replaceChildren(metric('COMPLETION / 完成进度',`${finished} / ${rows.length||3}`,'终态记录 / 计划执行'),metric('STRICT PASS / 严格通过',`${passed} / ${rows.length||3}`,'完成协议 + 独立 oracle + 预算'),metric('MODEL USAGE / API 用量',tokens.toLocaleString(),'服务端返回 token 总计 · 费用未知'),metric('FORMAL DENOMINATOR / 正式分母','0','LIVE_ENGINEERING · 不纳入正式统计'));
  $('arms').replaceChildren(...Object.entries(labels).map(([arm,[title,subtitle]])=>{
    const r=rows.find(r=>r.arm===arm)||{arm,status:'queued',frames:[],actions:[],requests:[]};const card=node('article',undefined,`arm ${r.status}`);const head=node('div',undefined,'arm-head');const titles=node('div');titles.append(node('h3',title),node('p',subtitle));head.append(titles,node('span',statusNames[r.status], 'badge'));card.append(head);
    const frame=node('div',undefined,'frame');const frames=r.frames||[];const key=`${selected}:${arm}`;let pos=positions.has(key)?Math.min(positions.get(key),frames.length-1):frames.length-1;
    const meta=node('div',undefined,'frame-meta'),time=node('span'),counter=node('span'),frameEvidence=node('pre');meta.append(time,counter);
    function show(i){pos=i;const f=frames[i];frameEvidence.textContent=JSON.stringify(f||null,null,2);frame.replaceChildren();if(f){const a=node('a');a.href=`/artifacts/${b.id}/${f.file}`;a.target='_blank';a.rel='noopener';const img=node('img');img.src=a.href;img.alt=`${title} ${f.phase} step ${f.step}`;a.append(img);frame.append(a);time.textContent=`${f.phase} · step ${f.step}`;counter.textContent=`${i+1} / ${frames.length}`;}else{frame.append(node('span','WAITING FOR FIRST FRAME','placeholder'));time.textContent='暂无截图';counter.textContent='0 / 0';}}
    show(pos);card.append(frame);const timeline=node('div',undefined,'timeline');const range=node('input');range.type='range';range.min=0;range.max=Math.max(0,frames.length-1);range.value=Math.max(0,pos);range.disabled=!frames.length;range.setAttribute('aria-label',`${title} 截图时间线`);range.oninput=()=>{positions.set(key,Number(range.value));show(Number(range.value));};range.ondblclick=()=>{positions.delete(key);show(frames.length-1);};timeline.append(range,meta);card.append(timeline);
    const body=node('div',undefined,'evidence-body'),stats=node('div',undefined,'mini-stats');const latency=r.agent_wall_ms??(r.status==='running'&&r.agent_started_at?Date.now()-Date.parse(r.agent_started_at):null);
    for(const [label,value]of[['ACTIONS',r.actions.length],['REQUESTS',r.requests.length],['AGENT TIME',latency===null?'—':`${(latency/1000).toFixed(1)}s`]]){const box=node('div'),valueNode=node('b',String(value));if(label==='AGENT TIME'&&r.status==='running'&&r.agent_started_at)valueNode.dataset.liveStarted=r.agent_started_at;box.append(node('small',label),valueNode);stats.append(box);}body.append(stats);
    const failure=r.failure_class||(r.protocol_completed&&r.oracle?.passed===false?'verdict-postcondition-disagreement（由终态推导）':'—');
    const verdict=node('div',undefined,'verdict');verdict.append(node('div',`Protocol: ${r.protocol_completed===undefined?'pending':r.protocol_completed?'completed':'not completed'}`),node('div',`Oracle: ${r.oracle?.passed===undefined?'未评估':r.oracle.passed?'通过':'未通过'}`,r.oracle?.passed?'green':''),node('div',`Failure: ${failure}`,failure!=='—'?'red':''));body.append(verdict);
    const events=node('div',r.actions.map((a,i)=>`${String(i+1).padStart(2,'0')}  ${a.type} ${a.target_id||a.name||a.key||a.text||(a.x!==undefined?`${a.x}, ${a.y}`:'')}`).join('\n')||'尚无执行动作','event-list');body.append(events);
    for(const [label,value]of[['模型响应 / 用量（不含隐藏推理）',r.requests],['独立 oracle / reset / 错误详情',{oracle:r.oracle,reset_digest:r.reset_digest,error:r.error,protocol:r.protocol}]]){const d=node('details');d.append(node('summary',label),node('pre',JSON.stringify(value,null,2)));body.append(d);}
    const frameDetail=node('details');frameDetail.append(node('summary','当前帧证据'),frameEvidence);body.append(frameDetail);
    if(r.finished_at&&b)addLink(body,'下载 Playwright replay trace ↗',`/artifacts/${b.id}/${arm}-trace.zip`);card.append(body);return card;
  }));
  $('foot').textContent=`${b?.id||'NO RUN'} · 每 1 秒刷新 · ${b?.framework||'PSS local diagnostic runtime'} · 轨迹仅本机落盘`;
}
$('batch').onchange=e=>{selected=e.target.value;last=null;render();};
$('start').onclick=async()=>{if(!confirm('将独立重置 Juice Shop 三次，并向已配置 Qwen 发送本地截图（Hybrid 含可见控件投影）。运行三策略工程示例？'))return;try{const res=await fetch('/api/start',{method:'POST',headers:{'x-local-token':state.token}});const result=await res.json();if(!res.ok)throw new Error(result.error);selected=result.id;last=null;await poll();}catch(e){alert(e.message);}};
async function poll(){try{const res=await fetch('/api/state');if(!res.ok)throw new Error('HTTP '+res.status);state=await res.json();$('connection').textContent=`● 本地服务在线 · ${new Date().toLocaleTimeString()}`;const stamp=JSON.stringify(state);if(stamp!==last){last=stamp;const open=[...document.querySelectorAll('details')].map(d=>d.open);render();document.querySelectorAll('details').forEach((d,i)=>d.open=open[i]||false);}}catch(e){$('connection').textContent='连接断开 · '+e.message;}}
await poll();setInterval(()=>{poll();document.querySelectorAll('[data-live-started]').forEach(el=>el.textContent=`${((Date.now()-Date.parse(el.dataset.liveStarted))/1000).toFixed(1)}s`);},1000);
