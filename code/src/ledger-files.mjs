import fs from 'node:fs';
import path from 'node:path';

function walk(root, output) {
  if (!fs.existsSync(root)) return;
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) return;
  for (const name of fs.readdirSync(root).sort()) {
    const file = path.join(root, name);
    const child = fs.statSync(file);
    if (child.isDirectory()) walk(file, output);
    else if (name.endsWith('.jsonl')) output.push(file);
  }
}

/**
 * Read all append-only ledgers, including migrated run-record directories.
 * Direct files are preferred over nested copies and duplicate run_ids are
 * retained only once. A duplicate is an audit signal, not extra evidence.
 */
export function readDeduplicatedJsonl(roots, { repoRoot = process.cwd() } = {}) {
  const files = [];
  for (const root of roots) walk(root, files);
  files.sort((left, right) => {
    const depth = (file) => file.split(path.sep).length;
    return depth(left) - depth(right) || left.localeCompare(right);
  });
  const entries = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Map();
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    lines.forEach((line, index) => {
      let raw;
      try {
        raw = JSON.parse(line);
        const runId = typeof raw?.run_id === 'string' ? raw.run_id : null;
        if (runId && seen.has(runId)) {
          duplicates.push({ run_id: runId, file: path.relative(repoRoot, file), line: index + 1, canonical_file: seen.get(runId).file, canonical_line: seen.get(runId).line });
          return;
        }
        const entry = { file: path.relative(repoRoot, file), line: index + 1, raw };
        entries.push(entry);
        if (runId) seen.set(runId, entry);
      } catch (error) {
        invalid.push({ file: path.relative(repoRoot, file), line: index + 1, error: error.message });
      }
    });
  }
  return { files: files.map((file) => path.relative(repoRoot, file)), entries, invalid, duplicates };
}
