import crypto from "node:crypto";

export const PROTOCOL = "wav-retrieval-json-v5-diagnostic";
export const OBSERVATION_POLICY = Object.freeze({
  min_ms: 2000, quiet_ms: 750, poll_ms: 250, max_ms: 6000,
  signal: "screenshot-bytes-only", semantic_readiness_claim: false,
});
export const MAX_CONSECUTIVE_PROTOCOL_ERRORS = 2;

export function resolveModel(env) {
  const model = (env.PSS_LOCAL_MODEL || env.CUA_MODEL || "").trim();
  if (!model) throw new Error("Explicit CUA_MODEL or PSS_LOCAL_MODEL required");
  return { model, source: env.PSS_LOCAL_MODEL ? "PSS_LOCAL_MODEL" : "CUA_MODEL" };
}

export function diagnosticTasks(allowed, value) {
  if (!value) return [...allowed];
  const ids = value.split(",").map(x => /^\d+$/.test(x) ? Number(x) : NaN);
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !allowed.includes(id)))
    throw new Error("Diagnostic subset must contain unique IDs from the pinned development selection");
  return ids;
}

// Explicit capability, not silent provider fallback. Qwen3-VL keeps JSON Object.
// https://help.aliyun.com/zh/model-studio/qwen-structured-output
export function responseFormat(model, controls, arm) {
  if (!/^qwen3\.7-flash(?:-|$)/.test(model)) return {type:"json_object"};
  const properties = {
    action: {type:"string",enum:["click","scroll","keypress","type","wait","done"]},
    x: {type:["integer","null"]}, y: {type:["integer","null"]},
    delta_y: {type:["integer","null"]},
    key: {type:["string","null"],enum:[null,"Enter","Tab","Escape","ArrowDown","ArrowUp","PageDown","PageUp"]},
    text: {type:["string","null"]},
    target_id: {type:["string","null"],enum:[null,...(arm==='hybrid'?controls.map(c=>c.target_id):[])]},
    answer: {type:["array","null"],items:{type:"string"}},
    note: {type:["string","null"]},
  };
  return {type:"json_schema",json_schema:{name:"pss_browser_action",strict:true,
    schema:{type:"object",properties,required:Object.keys(properties),additionalProperties:false}}};
}

// No DOM, URL, network, evaluator or task-specific readiness input is accepted.
// Quiet pixels are NOT proof of semantic readiness; the minimum dwell is mandatory.
export async function observePixels({ capture, sleep, now = Date.now,
  deadline = Infinity, policy = OBSERVATION_POLICY }) {
  const started = now();
  let lastHash, quietSince = started, samples = 0, image;
  while (true) {
    if (now() >= deadline) throw new Error("Agent wall-time budget exceeded");
    image = await capture();
    const hash = crypto.createHash("sha256").update(image).digest("hex");
    const time = now();
    samples++;
    if (hash !== lastHash) quietSince = time;
    lastHash = hash;
    if (time >= deadline) throw new Error("Agent wall-time budget exceeded");
    if (time - started >= policy.min_ms && time - quietSince >= policy.quiet_ms)
      return { image, samples, elapsed_ms: time - started, reason: "pixel-quiet", semantic_ready: null };
    if (time - started >= policy.max_ms)
      return { image, samples, elapsed_ms: time - started, reason: "observation-window-ended", semantic_ready: null };
    await sleep(Math.min(policy.poll_ms, deadline - time));
  }
}

export function parseDecision(output, { controls = [], arm }) {
  let d;
  try { d = JSON.parse(output); } catch { throw new Error("Invalid action JSON; return one complete object"); }
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("Invalid action object");
  // Strict provider schemas require every property; unused fields must be null.
  // Removing null fields is canonicalization, never inference of a missing action.
  d = Object.fromEntries(Object.entries(d).filter(([,value])=>value !== null));
  if (d.note !== undefined && (typeof d.note !== "string" || d.note.length > 2000))
    throw new Error("Invalid note; use at most 2000 characters");
  switch (d.action) {
    case "done":
      if (!Array.isArray(d.answer) || d.answer.some(x => typeof x !== "string"))
        throw new Error("Invalid answer; use an array of strings");
      break;
    case "click":
      if (d.target_id !== undefined) {
        if (arm !== "hybrid" || !controls.some(c => c.target_id === d.target_id))
          throw new Error("Invalid observation-local target; use only this observation's IDs");
      } else if (![d.x, d.y].every(x => Number.isInteger(x) && x >= 0 && x <= 1000))
        throw new Error("Invalid coordinates; use integer x,y in 0..1000");
      break;
    case "scroll":
      if (!Number.isInteger(d.delta_y) || Math.abs(d.delta_y) > 1440)
        throw new Error("Invalid scroll; delta_y must be an integer in -1440..1440");
      break;
    case "keypress":
      if (!["Enter", "Tab", "Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(d.key))
        throw new Error("Invalid key");
      break;
    case "type":
      if (typeof d.text !== "string" || d.text.length > 200) throw new Error("Invalid type text");
      break;
    case "wait": break;
    default: throw new Error("Invalid action name");
  }
  return d;
}

export function modelMessages(prompt, previous, current) {
  const content = [{ type: "text", text: prompt }];
  for (const frame of previous.slice(-2)) content.push(
    { type: "text", text: `Previous screenshot at observation ${frame.step}; not the current screen.` },
    { type: "image_url", image_url: { url: frame.image } },
  );
  content.push({ type: "text", text: "Current screenshot; ground the next action here." },
    { type: "image_url", image_url: { url: current } });
  return [{ role: "user", content }];
}

export function confirmAnswer(candidate, answer) {
  return candidate !== null && JSON.stringify(candidate) === JSON.stringify(answer);
}
