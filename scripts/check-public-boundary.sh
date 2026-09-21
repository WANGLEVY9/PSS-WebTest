#!/bin/sh
set -eu
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

# Inspect tracked/staged paths, including force-added files. This is a path
# publication policy, not a complete secret or dataset-content scanner.
tracked_private=$(git ls-files -- \
  'paper/**' 'private-paper/**' 'submission/**' \
  '*.tex' '*.bib' '*.bst' '*.cls' '*.sty' \
  'research/data-entry/**' 'research/PSS-WebTest-Overleaf-*.zip' \
  'code/results/**' '.workbuddy/**')

if [ -n "$tracked_private" ]; then
  echo "ERROR: private manuscript, internal mock, or local-only output paths are tracked:" >&2
  echo "$tracked_private" >&2
  exit 1
fi

echo "Public-boundary check passed: no restricted publication paths are tracked."
