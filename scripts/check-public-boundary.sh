#!/bin/sh
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

tracked_private=$(git ls-files 'paper/**' 'private-paper/**' 'submission/**' '*.tex' '*.bib' '*.bst' '*.cls' '*.sty')

if [ -n "$tracked_private" ]; then
  echo "ERROR: private manuscript/submission files are tracked:" >&2
  echo "$tracked_private" >&2
  exit 1
fi

echo "Public-boundary check passed: no manuscript or submission files are tracked."
