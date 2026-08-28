# Introduction Figure Prompt for PSS-WebTest

下面的 prompt 面向图像生成模型，用于生成 introduction figure 的第一版构图草稿。最终投稿图建议在 Figma、Illustrator、draw.io 或 TikZ 中按同一布局重绘，以保证文字、线宽和单栏缩放完全可控。

## Copy-ready prompt

```text
FRAMING
Create a publication-quality vector technical overview diagram for an ACM SIGSOFT ISSTA research paper introduction. The figure title is: “Pixels, Page Structure, or Scripts? A Condition-Aware Empirical Study of Web UI Testing”. The figure explains the complete research architecture and experimental logic of PSS-WebTest, not a software product UI and not a results chart. The central message is that the study estimates conditional advantages, failure boundaries, maintenance costs, and complementarity across three Web testing strategies. Do not imply that any strategy is universally superior. Make the diagram readable when placed at approximately 0.95 column width in an ACM single-column paper, with an optional full-width version.

VISUAL STYLE
Use a classic ACM/SIGSOFT software-testing paper style: clean flat 2D vector graphics, precise alignment, generous whitespace, thin gray connectors, rounded rectangles, restrained color accents, and no decorative illustration. Use a white background with very light gray section bands. Use Helvetica, Arial, Inter, or another neutral sans-serif font. Use dark charcoal text, bold section titles, and regular-weight explanatory labels. Use 1.5 px connectors and 1 px borders. Use consistent 6 px corner radius. Use filled arrowheads, orthogonal or gently curved routing, and no 3D perspective. Use no gradients, no glossy effects, no photorealism, no clip-art, no emojis, no stock icons, and no large logos. Use colorblind-safe colors with sufficient contrast. The figure should look like a carefully typeset research-method overview from a recent software testing conference paper.

COLOR PALETTE
Use the following fixed palette. Background: #FFFFFF. Section band: #F7F8FA. Main text: #1F2937. Secondary text: #4B5563. Connector: #6B7280. Boundary/dashed evaluator line: #9CA3AF. Pure-visual arm accent: #2563EB blue. Hybrid arm accent: #0F766E teal. Traditional Playwright accent: #D97706 amber. SUT/application accent: #64748B slate. Experimental-condition accent: #7C3AED purple. Independent-oracle accent: #BE185D magenta. Evidence/admission accent: #059669 green. Error/failure annotation: #DC2626 red. Keep colored fills pale and use saturated colors only for accent bars and headings.

LAYOUT
Use a wide horizontal composition with five clearly separated regions connected from top to bottom.

Region 1, top-left: a small section titled “Matched Web testing intent”. Put a neutral browser-window thumbnail with simple abstract UI elements, a natural-language task card, and a small label “same intent, same initial state, same budget”. Do not draw a realistic website or any proprietary logo.

Region 1, top-right: a compact factor strip titled “Study factors”. Show the exact formula on one line: “SUT × task × condition × arm × model/provider × repetition”. Under it, show six small neutral chips: “Web application”, “Workflow”, “Clean / fault / evolution”, “Testing strategy”, “Vision model”, “Repeated run”.

Region 2, center-left: a large section titled “Three matched testing strategies”. Arrange three parallel vertical cards with equal width and equal height. Each card has a colored accent bar on the left, a short exact title, an observation contract line, an action line, and one small neutral line describing what is excluded.

Card A, blue: title “A. Pure-visual CUA”. Observation line: “screenshot-only”. Processing line: “vision model → coordinate / keyboard actions”. Exclusion line: “no DOM, accessibility tree, selectors, or hidden state”. Add a minimal screenshot icon drawn as a rectangle with two simple controls, not a real screenshot.

Card B, teal: title “B. Hybrid agent”. Observation line: “screenshot + declared page structure”. Processing line: “vision model → grounded browser actions”. Exclusion line: “no gold oracle, database state, or mutation label”. Add two tiny inputs entering the card: a screenshot rectangle and a structure/list rectangle.

Card C, amber: title “C. Accessibility-locator Playwright”. Observation line: “role / label / justified test-id locators”. Processing line: “deterministic script → browser actions”. Exclusion line: “no runtime LLM adaptation”. Add a minimal code-sheet icon with three short lines, not source code text.

Region 2, center-right: place a large slate section titled “Systems under test”. Inside it, show three equal application tiles: “BookStack”, “Indico”, and “OWASP Juice Shop”. Under the tiles add one line: “version-pinned, self-hosted, resettable”. Draw solid arrows from each of the three strategy cards into this SUT section. The arrows must be visually parallel and must communicate that all strategies execute the same matched intent against the same application condition.

Region 3, middle full width: a horizontal purple section titled “Controlled Web UI conditions”. Show three condition columns with equal spacing.

Column 1: “Clean stable” with a small checkmark-like neutral state icon and the sublabel “baseline behavior”.

Column 2: “Functional fault” with the sublabel “seeded persistence / validation / relation defect”. Use a tiny bug glyph drawn as simple line art, not an emoji.

Column 3: “Behavior-preserving UI evolution” with four small subchips: “DOM/layout”, “accessibility semantics”, “visual layout”, and “runtime delay”. Add a note below: “business intent and oracle semantics remain fixed”.

Draw a thin purple connector from the SUT section into all three condition columns. Do not draw a red arrow suggesting that UI evolution is necessarily a software defect.

Region 4, lower-middle full width: an independent evaluator boundary. Draw a large rounded rectangle with a dashed magenta outline titled “Independent evaluator — hidden from all testing arms”. Inside it, place three oracle blocks: “Visible UI oracle”, “Persisted / relational oracle”, and “Fault / evolution invariant”. Add a small note: “agent verdict is never ground truth”. Use a dashed line from the testing execution region into the evaluator, but do not show hidden oracle data entering any strategy card. Show the evaluator producing four compact outputs: “task state reached”, “verdict correctness”, “repair success / effort”, and “latency / cost / stability”.

Region 5, bottom full width: a green evidence and analysis pipeline titled “Append-only evidence → condition-aware conclusions”. Show five small sequential boxes: “run record”, “failure taxonomy”, “paired cell summary”, “mixed-effects / uncertainty analysis”, and “decision boundary”. Put a short final statement in the last box: “which strategy is preferable under which condition?”. Add three small neutral outcome tags below it: “visual advantage”, “hybrid complementarity”, and “deterministic baseline advantage”. These must be labeled as possible conditional findings, not predetermined results.

Add a small side inset at the bottom-right titled “Admission gate”. It should show two stacked stages: “Feasibility / pilot” and “Confirmatory collection”. Between them place a lock icon and the text “reset + independent oracle + three-arm clean admission + power freeze”. The inset must explicitly say “pilot evidence is exploratory” and must not display fabricated success rates or p-values.

CONNECTIONS
1. “Matched Web testing intent” → each of the three strategy cards: thin dark-gray arrows labeled “same intent”.
2. Each strategy card → “Systems under test”: parallel solid arrows labeled “browser actions”.
3. “Systems under test” → each controlled condition column: purple arrows labeled “condition assignment”.
4. Each condition column → “Independent evaluator”: dashed magenta arrows labeled “post-run observable state”.
5. “Independent evaluator” → the four outcome blocks: solid magenta arrows labeled “independent score”.
6. Outcome blocks → “Append-only evidence”: solid gray arrows labeled “immutable run record”.
7. “Append-only evidence” → “decision boundary”: solid green arrow labeled “estimate conditional performance”.
8. From “decision boundary” back to “Study factors”, draw one thin gray feedback arrow labeled “interpret by task, oracle, evolution, and model”. This is an analysis interpretation loop, not an online adaptation loop.
9. Do not connect the hidden evaluator blocks directly to any agent observation input. Do not show the gold oracle, database truth, mutation label, or application state flowing into the visual or hybrid cards.

TEXT AND CONSTRAINTS
Use exactly the quoted labels above. Keep all labels short, horizontal, and inside their boxes. No paragraphs, no tiny footnotes, no numerical result claims, no p-values, no fake charts, no leaderboard, no “winner” badge, and no implication that one arm is universally best. Do not merge Qwen and Doubao into one generic model icon. If a model label is needed, write “model/provider stratum” rather than inventing model names. Do not include API keys, credentials, private URLs, or raw traces. Keep the independent evaluator visually separated from all arms. Ensure every arrow has one clear direction and no crossings through text. Export as a crisp vector-like figure with a 16:10 aspect ratio, suitable for later redrawing in TikZ or Figma.
```

## 建议的图注

**Figure 1. Overview of PSS-WebTest.** We compare pure-visual CUA, hybrid visual-plus-page-structure agents, and accessibility-locator Playwright under matched Web testing intents, controlled functional faults, and behavior-preserving UI evolution. All arms execute against resettable self-hosted applications and are scored by independent UI, persisted-state, relational, and invariant oracles. The resulting run records support condition-aware estimates of completion, verdict correctness, repair effort, cost, latency, stability, and failure boundaries rather than a universal ranking.

## 使用提醒

图像生成模型通常会错误渲染较长文字，因此建议把这段 prompt 用于生成布局和视觉草图，再在 Figma、Illustrator、draw.io 或 TikZ 中重绘文字与箭头。Introduction 主图应优先表达研究逻辑，不要把当前 BookStack pilot 的成功率放进主图；具体 pilot 数字应放在实验设置或结果图中，并按 model/provider 分层报告。
