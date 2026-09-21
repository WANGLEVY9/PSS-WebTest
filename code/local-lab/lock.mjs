import fs from "node:fs";
import path from "node:path";
export function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== "ESRCH";
  }
}
export function acquireLock(root) {
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, ".runner.lock");
  try {
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid }), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let owner;
    try {
      owner = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      throw new Error("Unparseable lock: inspect manually before continuing");
    }
    if (alive(owner.pid))
      throw new Error("Another local runner owns the SUT reset lock");
    fs.unlinkSync(file);
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid }), {
      flag: "wx",
      mode: 0o600,
    });
  }
  return () => {
    try {
      if (JSON.parse(fs.readFileSync(file)).pid === process.pid)
        fs.unlinkSync(file);
    } catch {}
  };
}
