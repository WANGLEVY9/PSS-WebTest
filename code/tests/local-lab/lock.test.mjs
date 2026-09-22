import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { acquireLock } from "../../local-lab/lock.mjs";
test("one reset owner at a time; release permits next run", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pss-lock-test-"));
  const release = acquireLock(dir);
  assert.throws(() => acquireLock(dir), /Another local runner/);
  release();
  acquireLock(dir)();
  fs.rmdirSync(dir);
});
