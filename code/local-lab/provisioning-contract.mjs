export function nativeInitializerExited(status, stdout) {
  return [0,3].includes(status) && /^env-ctrl-init\s+EXITED\b/m.test(stdout);
}

export function assertDisposableInstance(info, runId, imageDigest) {
  if (!runId || !imageDigest || info?.Config?.Labels?.['pss.preflight-run'] !== runId ||
      !Array.isArray(info.Mounts) || info.Mounts.length !== 0 || info.Image !== imageDigest)
    throw Error('Refuse lifecycle action: owned label, image or mount check failed');
  return info;
}
export function imageCapacityGate(compressedBytes, availableBytes) {
  const known=[compressedBytes,availableBytes].every(n=>Number.isSafeInteger(n) && n>0);
  // A conservative engineering reserve, NOT an official benchmark requirement
  // or proof of unpacked size; compressed bytes alone are a hard lower bound.
  const required=known?compressedBytes*2:null;
  return {allowed:known && availableBytes>=required,compressed_bytes:known?compressedBytes:null,
    available_bytes:known?availableBytes:null,engineering_reserve_bytes:required,
    reason:!known?'capacity-unknown':availableBytes<compressedBytes?'below-compressed-size-lower-bound':availableBytes<required?'below-provisioning-reserve':'space-precheck-only'};
}

export function parseDfKilobytes(output) {
  const fields=output.trim().split('\n').at(-1).trim().split(/\s+/);
  if(fields.length<6 || !/^\d+%$/.test(fields[4]) || !/^\d+$/.test(fields[3]))
    throw Error('Unrecognized VM filesystem capacity output');
  return Number(fields[3])*1024;
}
