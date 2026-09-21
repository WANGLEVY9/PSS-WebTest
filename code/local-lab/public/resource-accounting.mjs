// Browser-safe accounting shared by console and runner. Missing usage is never zero-imputed.
export function reportedTotal(values) {
  const known=values.filter(n=>typeof n==='number' && Number.isFinite(n) && n>=0);
  const subtotal=known.reduce((a,b)=>a+b,0);
  return {total:known.length===values.length?subtotal:null,reported_subtotal:subtotal,
    reported:known.length,expected:values.length,coverage:values.length?known.length/values.length:null};
}
export function requestUsage(requests=[]) {
  return reportedTotal(requests.map(r=>r.usage?.total_tokens));
}
export function tokenLabel(requests=[]) {
  const s=requestUsage(requests);
  return s.total!==null?s.total.toLocaleString('en-US'):s.reported?`${s.reported_subtotal.toLocaleString('en-US')} (partial)`:'Unavailable';
}
