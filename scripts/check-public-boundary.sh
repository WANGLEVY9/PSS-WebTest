#!/bin/sh
set -eu
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

# Git ignores do not untrack files already in the index. Inspect the index itself.
tracked=$(git ls-files -- \
  'paper/**' 'private-paper/**' 'submission/**' 'temp/**' 'legacy/**' 'DataLog/**' \
  'results/**' 'code/results/**' 'code/artifacts/**' 'code/docs/status/**' \
  'code/config/archive/**' 'code/src/**' 'code/scripts/**' 'code/dashboard/**' \
  'code/manifests/**' 'code/sut/**' 'code/agentlab_adapter/**' \
  'code/tests/contracts/**' 'code/tests/traditional/**' 'code/local-lab/**' \
  '.workbuddy/**' '.codebuddy/**' 'skills/**' \
  '*.tex' '*.bib' '*.bst' '*.cls' '*.sty' '*.jsonl' '*.log' '*.pdf')
if [ -n "$tracked" ]; then
  echo "ERROR: local, historical, or generated paths are tracked:" >&2
  echo "$tracked" >&2
  exit 1
fi
printf '%s\n' 'Public-boundary check passed: restricted paths are absent from the Git index.'
