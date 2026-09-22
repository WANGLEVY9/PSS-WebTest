import test from "node:test";
import assert from "node:assert/strict";
import { resolveModel, observePixels, parseDecision, modelMessages, confirmAnswer, diagnosticTasks, responseFormat, coordinateToPixels, ACTION_CONVENTIONS } from "../../local-lab/agent-protocol.mjs";

test("actuator coordinates use independent axes, never infer pixel units", () => {
  assert.deepEqual(coordinateToPixels(695,431,{width:1280,height:720}),{x:890,y:310});
  assert.deepEqual(coordinateToPixels(500,500,{width:1280,height:720}),{x:640,y:360});
  assert.deepEqual(coordinateToPixels(1000,1000,{width:1280,height:720}),{x:1279,y:719});
  for (const x of [-1,1001,0.1,'500',null]) assert.throws(()=>coordinateToPixels(x,1,{width:1280,height:720}));
  assert.match(ACTION_CONVENTIONS,/positive scrolls DOWN, negative scrolls UP/);
  assert.equal(parseDecision('{"action":"scroll","delta_y":-500}',{arm:'visual'}).delta_y,-500);
});

test("model uses configured value, explicit override only, no silent legacy fallback", () => {
  assert.deepEqual(resolveModel({ CUA_MODEL: "qwen3.7-flash" }), {model:"qwen3.7-flash",source:"CUA_MODEL"});
  assert.equal(resolveModel({CUA_MODEL:"a",PSS_LOCAL_MODEL:"b"}).model,"b");
  assert.throws(()=>resolveModel({}));
});
test("diagnostic subsets cannot introduce unfrozen tasks or duplicate repeats", () => {
  assert.deepEqual(diagnosticTasks([163,167],"167"),[167]);
  assert.throws(()=>diagnosticTasks([167],"167,167"));
  assert.throws(()=>diagnosticTasks([167],"1"));
});
test("Qwen3.7 schema constrains coordinates, action and current IDs without exposing controls to visual", () => {
  const hybrid=responseFormat('qwen3.7-flash',[{target_id:'o1-c0'}],'hybrid');
  const visual=responseFormat('qwen3.7-flash',[{target_id:'SECRET'}],'visual');
  assert.equal(hybrid.type,'json_schema');
  assert.deepEqual(hybrid.json_schema.schema.properties.target_id.enum,[null,'o1-c0']);
  assert.deepEqual(visual.json_schema.schema.properties.target_id.enum,[null]);
  assert.doesNotMatch(JSON.stringify(visual),/SECRET/);
  assert.equal(responseFormat('qwen3-vl-flash',[],'visual').type,'json_object');
  assert.equal(parseDecision('{"action":"done","answer":["a"],"note":null,"target_id":null}',{arm:'visual'}).action,'done');
  assert.throws(()=>parseDecision('{"answer":["a"]}',{arm:'hybrid'}));
  assert.throws(()=>parseDecision('{"action":"click","x":"703","y":"428"}',{arm:'visual'}));
});
for (const delay of [0, 885, 1503, 2100]) test(`pixel-only dwell handles delayed paint ${delay} ms`, async () => {
  let time = 0;
  const result = await observePixels({ now:()=>time, sleep:async ms=>{time+=ms;}, capture:async()=> time < delay ? "empty" : "loaded" });
  // 2100 is deliberately outside the minimum dwell: stable emptiness is NOT readiness.
  if (delay <= 1503) assert.equal(result.image,"loaded");
  assert.ok(result.elapsed_ms>=2000);
  assert.equal(result.semantic_ready,null);
});
test("animation observation is bounded and deadline includes screenshot waits", async () => {
  let time=0;
  const opts={now:()=>time,sleep:async ms=>{time+=ms;},capture:async()=>String(time)};
  assert.equal((await observePixels(opts)).reason,"observation-window-ended");
  assert.equal(time,6000);
  time=0;
  await assert.rejects(observePixels({...opts,deadline:1200}),/budget/);
});
test("invalid, stale and visual structural actions rejected before execution", () => {
  const context={arm:"hybrid",controls:[{target_id:"o1-c0"}]};
  for(const output of ['{"action":"scroll","delta_y":500.0000000', '{"action":"click","target_id":"o0-c0"}', '{"action":"scroll","delta_y":1.5}', 'null'])
    assert.throws(()=>parseDecision(output,context));
  assert.throws(()=>parseDecision('{"action":"click","target_id":"o1-c0"}',{...context,arm:"visual"}));
  assert.equal(parseDecision('{"action":"click","target_id":"o1-c0"}',context).action,"click");
});
test("bounded screenshot history carries no observer metadata or old structure", () => {
  const frames=[0,1,2].map(step=>({step,image:`frame-${step}`,url:"SECRET_URL",controls:"SECRET_DOM"}));
  const messages=modelMessages("pixel-only",frames,"current");
  assert.doesNotMatch(JSON.stringify(messages),/SECRET|frame-0/);
  assert.equal(messages[0].content.filter(x=>x.type==='image_url').length,3);
});
test("done requires a second observation and matching candidate, not an oracle", () => {
  assert.equal(confirmAnswer(null,[]),false);
  assert.equal(confirmAnswer([],[]),true);
  assert.equal(confirmAnswer(['a'],['b']),false);
});
