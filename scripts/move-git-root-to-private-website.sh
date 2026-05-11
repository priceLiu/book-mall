#!/usr/bin/env bash
# One-time: move Git repo root from book-mall/ to private_website/ so tool-web/ is tracked together.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d book-mall/.git ]]; then
  echo "Expected book-mall/.git — already moved or path wrong." >&2
  exit 1
fi
if [[ -d .git ]]; then
  echo "private_website/.git already exists — remove or merge manually." >&2
  exit 1
fi

mv book-mall/.git "$ROOT/.git"
echo "Moved .git to $ROOT/.git"
echo "Staging path remap (book-mall/* + tool-web/*) …"
git add -A
git status
echo
echo "Next: review status, then commit, e.g.:"
echo "  git commit -m \"chore: move repo root to private_website (monorepo with tool-web)\""
