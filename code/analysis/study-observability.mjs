import {reportedTotal} from '../console/public/resource-accounting.mjs';
// No imputed billing rate or amortized labor. Shared preparation is represented once by prep_id.
export function preparationSummary(rows=[]) {
  const seen=new Set(),groups=new Map();
  for(const r of rows) {
    if(typeof r.prep_id!=='string'||!r.prep_id||seen.has(r.prep_id)) throw Error('Unique preparation IDs required; do not repeat shared script costs by model');seen.add(r.prep_id);
    if(!['wav','vwa','ata','SHARED'].includes(r.benchmark)||!['logged','retrospective_estimate','assumed','unknown'].includes(r.measurement_basis)||!['task','configuration','shared'].includes(r.scope)) throw Error('Preparation scope and measurement basis required');
    if(typeof r.config_id!=='string'||!r.config_id) throw Error('Preparation configuration required');
    const key=JSON.stringify([r.benchmark,r.config_id,r.measurement_basis]),a=groups.get(key)||[];a.push(r);groups.set(key,a);
    for(const f of ['authoring_minutes','debugging_minutes','review_minutes']) if(r[f]!==null && (!Number.isFinite(r[f])||r[f]<0)) throw Error('Preparation time must be nonnegative or explicit null');
  }
  return [...groups.entries()].map(([key,rs])=>{
    const [benchmark,config_id,measurement_basis]=JSON.parse(key),minutes=reportedTotal(rs.flatMap(r=>[r.authoring_minutes,r.debugging_minutes,r.review_minutes]));
    return {benchmark,config_id,measurement_basis,records:rs.length,hours:minutes.total===null?null:minutes.total/60,reported_hours_subtotal:minutes.reported_subtotal/60,coverage:minutes.coverage,shared_counted_once:true};
  });
}
export function executionResourceSummary(records) {
  const groups=new Map();for(const r of records){const a=groups.get(r.config_id)||[];a.push(r);groups.set(r.config_id,a);}
  return [...groups.entries()].map(([config_id,rs])=>({config_id,imported_opportunities:rs.length,
    // Keep scheduled, imported and started denominators distinct; absent resource fields remain null.
    started:rs.filter(r=>r.started).length,
    execution_charge_usd:reportedTotal(rs.map(r=>r.execution_charge_usd)),
    agent_wall_ms:reportedTotal(rs.map(r=>r.agent_wall_ms)),
    provider_tokens:reportedTotal(rs.map(r=>r.total_tokens)),
    preparation_included:false,monetary_imputation:false}));
}
