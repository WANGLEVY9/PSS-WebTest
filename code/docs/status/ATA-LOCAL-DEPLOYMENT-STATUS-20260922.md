# ATA local deployment feasibility — 22 September 2026

## What the original benchmark requires

The [paper, sections 4.2–4.3 and 8](https://arxiv.org/html/2504.01495v1)
uses the original WebArena/VisualWebArena Classifieds, Postmill and Shopping
applications. Cases are self-contained and each starts from a fresh deployment.
The 51 FAIL cases modify passing test instructions to demand unimplemented
features. They do **not** imply 51 mutated application builds. The installed
published artifact contains 62 PASS and 51 FAIL cases. Labels alone are not
execution evidence.

## Read-only availability checks

- Hosted application addresses are documented in the
  [official PinATA repository](https://github.com/Smartesting/pinata).
  Requests to its documented three ports failed from this machine. This does
  not prove a global outage. No hosted reset workflow or mutation was attempted.
- The evaluation script's reset repository, `Smartesting/vtaas-benchmark`,
  returned `Repository not found` to `git ls-remote`; private/deleted/unavailable
  cannot be distinguished with this evidence.
- The pinned original VWA deployment README also provides local image mirrors.
  The [Postmill archive metadata](https://archive.org/metadata/postmill-populated-exposed-withimg)
  lists `postmill-populated-exposed-withimg.tar`, 53,435,097,088 bytes,
  SHA1 `c19eaed0886a008fe51370b36b22f61ed49f6392`.
  Docker VM available storage measured during these probes was approximately
  28–31 GB; it cannot safely load that archive plus extracted layers and reserve.
- [Original Shopping archive metadata](https://archive.org/metadata/webarena-env-shopping-image)
  returned no file list in this check. Do not interpret that as a zero-byte image.
  The CMU HTTP mirror returned 403; the same host's HTTPS handshake failed.
  The Google Drive mirror was inaccessible through the web reader. A bounded
  2,009-byte read of its direct download information page subsequently returned
  `Google Drive - Quota exceeded`, not an image archive. No mirror restriction
  was bypassed and no large download was started. Image size remains unverified.
- Installed Docker images in the x86 context include WAV-Verified Shopping and
  MySQL, not original Postmill, Classifieds or original Shopping.

## Why existing WAV Shopping is not silently used for ATA

The pinned WAV source adds a `CustomerAutoLogin` module, a control API and
resource/entrypoint changes to its optimized Shopping image. It may be a useful
engineering candidate, but a matching brand/page is not proof of original
application, account, data and assertion parity. Any port to that image must be
explicitly labelled a port and validated against the published ATA instructions
and baseline, without leaking expected PASS/FAIL labels to the actor.

## Next deployable path

Obtain a reachable original Shopping image mirror plus its digest/size first;
check actual Docker-root capacity with expansion and writable-layer reserve.
Use a new loopback-only, independently resettable owned instance. Validate
baseline accounts and data, then perform positive/negative published-case
controls and all execution profiles. If an original image cannot fit locally,
the sponsor host needs adequate disk and the same pinned deployment recipe.
There are currently **zero new ATA official executions** from these checks.

## Subsequent feasible retrieval path (same session)

The physical host has approximately **566 GiB free and 48 GiB RAM**. Thus the
60-GiB existing Docker VM's limit must not be described as a whole-machine
capacity limit. The original Postmill mirror returned HTTP 206 for bounded
range requests: 1 MiB in 2.957 seconds and 16 MiB in 4.977 seconds. Transfer
startup dominates small samples; this is not a guaranteed whole-file speed.

`retrieve_ata_postmill.py` now provides an explicit opt-in download-only step:
53,435,097,088-byte cap, four-hour timeout, 8-MiB/s rate cap, sufficient physical
disk reserve, upstream SHA1 verification and a freshly computed SHA256. It
refuses to overwrite an old output directory. Partial files are not images
admitted for execution. Retrieval has been started in ignored local artifacts;
inspect its report or the current partial size rather than assuming completion.

After checksum completion, deploy into a **separate**, explicitly selected
x86 Docker VM with sufficient space (a 160-GiB disk is a provisional engineering
allocation, not a benchmark requirement). Do not resize/restart the running WAV
VM mid-experiment or change the default Docker context. Inspect the original
image's services, volumes, ports and initialization behavior before running it;
the WAV `env-ctrl` lifecycle cannot be assumed to exist in that image. ATA
published login actions remain actor task steps, not secretly pre-completed
supervisor actions. Validate baseline data and per-case reset before evaluating.

The archive download overlaps later task-274 diagnostic probes. Their latency
measurements must not be treated as isolated-host performance estimates.
