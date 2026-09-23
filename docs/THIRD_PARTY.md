# Third-party acknowledgments

Fixed-version installation, evaluator order and deliberate study restrictions are documented in the [upstream traceability matrix](technical/UPSTREAM_TRACEABILITY.md). See individual benchmark/framework pages for source links and open parity checks, and the [cloud dependency inventory](../code/experiment/cloud-handoff/dependency-manifest.json) for declared package provenance. That inventory is not a validated Linux install lock.

PSS-WebTest builds on public benchmarks and open-source browser automation. The repository's MIT license covers its own code and documentation; it does not relicense upstream datasets, applications, assets, models or fixtures. Record exact upstream revisions and comply with their distribution/access terms.

| Upstream | Role in this project |
| --- | --- |
| [WebArena-Verified](https://github.com/ServiceNow/webarena-verified) | Versioned Web tasks and native response/network evaluation |
| [VisualWebArena](https://github.com/web-arena-x/visualwebarena) | Visually grounded Web tasks, images and evaluation |
| [ATA artifact](https://zenodo.org/records/15198569) and [paper](https://arxiv.org/abs/2504.01495) | Explicit test cases, reference verdicts and failure-step metrics |
| [AgentLab](https://github.com/ServiceNow/AgentLab) | Agent framework used by the visual/hybrid design |
| [BrowserGym](https://github.com/ServiceNow/BrowserGym) | Browser interaction/environment components |
| [Browser Use](https://github.com/browser-use/browser-use) | Framework components for the restricted hybrid design |
| [Playwright](https://github.com/microsoft/playwright) | Browser automation, scripted baseline and browser regression tests |

Task inputs and evaluator references remain separate. In particular, an upstream BrowserGym WebArena integration is not a substitute for the WebArena-Verified release and evaluator. Use the pinned source references recorded by the study, not whichever upstream HEAD happens to be current.

Earlier BookStack, Indico, Juice Shop, Invoice Ninja and PrestaShop pilots are historical infrastructure work, outside the current three-benchmark core sample. Their application licenses and reset/fixture assumptions remain specific to those pilots.
