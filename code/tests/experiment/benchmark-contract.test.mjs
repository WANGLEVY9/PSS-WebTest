import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { retrievalResponse, evaluatorSummary } from "../../experiment/benchmark-contract.mjs";
test("empty retrieval uses official not-found status, not success", () => {
  assert.equal(retrievalResponse([], true).status, "NOT_FOUND_ERROR");
  assert.equal(retrievalResponse(["fixture-name"], true).status, "SUCCESS");
  assert.equal(retrievalResponse(null, false).status, "UNKNOWN_ERROR");
  assert.throws(() => retrievalResponse(null, true));
});
test("public evaluator summary never exports gold and keeps evaluation error unresolved", () => {
  const result = evaluatorSummary({
    status: "error",
    score: 0,
    evaluators_results: [
      {
        error_msg: "Schema validation failed",
        expected: "SECRET_EXPECTED",
        actual: "SECRET_ACTUAL",
      },
    ],
  });
  assert.equal(result.passed, null);
  assert.deepEqual(result.errors, ["Schema validation failed"]);
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  assert.equal(evaluatorSummary({ status: "success", score: 1 }).passed, true);
  assert.equal(evaluatorSummary({ status: "failure", score: 0 }).passed, false);
});
test("local console starts official benchmark runner, not engineering smoke", () => {
  const server = fs.readFileSync(
    new URL("../../console/server.mjs", import.meta.url),
    "utf8",
  );
  assert.match(server, /benchmark-runner\.mjs/);
  assert.doesNotMatch(server, /path\.join\(root, "runner\.mjs"\)/);
});
test("console chrome is English and preserves integration scope", () => {
  for (const name of ["index.html", "app.js"])
    assert.doesNotMatch(
      fs.readFileSync(new URL(`../../console/public/${name}`, import.meta.url), "utf8"),
      /[\u3400-\u9fff]/,
    );
  const html = fs.readFileSync(
    new URL("../../console/public/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /Non-confirmatory/);
  assert.match(html, /lang="en"/);
});
