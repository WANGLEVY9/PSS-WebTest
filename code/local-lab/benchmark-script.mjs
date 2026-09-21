// Frozen before official reference scoring or either agent's run.
// AI-assisted adaptation of public UI; no hard-coded reviewer names.
export async function runReviewScript(page, task, onStep) {
  if (
    ![222, 136].includes(task.intent_template_id) ||
    (task.intent_template_id === 222 && ![21, 22].includes(task.task_id))
  )
    throw new Error("Traditional adaptation unavailable for this task");
  await page.getByRole("link", { name: /^\d+\s+Reviews/i }).click();
  await page.locator(".review-item").first().waitFor({ state: "visible" });
  await onStep({ type: "locator-click", name: "Product reviews" });
  const names = new Set(),
    seen = new Set();
  for (let p = 0; p < 12; p++) {
    const items = page.locator(".review-item");
    const texts = await items.allInnerTexts();
    const signature = JSON.stringify(texts);
    if (seen.has(signature))
      throw new Error("Review pagination did not advance");
    seen.add(signature);
    for (let i = 0; i < texts.length; i++) {
      await items.nth(i).scrollIntoViewIfNeeded();
      if (task.intent_template_id === 136) {
        // Public tooltip percentages. Convention frozen before this template's outcomes.
        const ratings = await items
          .nth(i)
          .locator(".rating-result")
          .evaluateAll((nodes) =>
            nodes.map((n) => Number.parseFloat(n.getAttribute("title"))),
          );
        if (
          !ratings.length ||
          ratings.some((n) => !Number.isFinite(n) || n < 0 || n > 100)
        )
          throw new Error("Visible review rating unavailable");
        const matched =
          ratings.reduce((a, b) => a + b, 0) / ratings.length <= 40;
        if (matched)
          names.add(
            (await items.nth(i).locator(".review-title").innerText()).trim(),
          );
        await onStep({
          type: "read-review",
          name: `Page ${p + 1}, review ${i + 1}`,
          matched,
          rating_policy: "mean-visible-percent<=40",
        });
        continue;
      }
      const text = texts[i],
        content = text.split("Review by")[0];
      const relevant =
        task.task_id === 21
          ? /ear\s*cups?|cups?\s*for\s*ears?/i.test(content) &&
            /small|half my ear|won.t go over mine/i.test(content)
          : /under[\s-]?water/i.test(content) &&
            /photo|picture|camera/i.test(content);
      if (relevant) {
        const m = text.match(/Review by\s+([\s\S]*?)\s+Posted on/i);
        if (m) names.add(m[1].trim());
      }
      await onStep({
        type: "read-review",
        name: `Page ${p + 1}, review ${i + 1}`,
        matched: relevant,
      });
    }
    const next = page.getByRole("link", { name: /Page Next/ });
    if ((await next.count()) === 0) break;
    const old = await items.first().innerText();
    await next.click();
    await page.waitForFunction(
      (previous) =>
        document.querySelector(".review-item")?.innerText !== previous,
      old,
    );
    await onStep({ type: "locator-click", name: "Next review page" });
  }
  return [...names];
}
