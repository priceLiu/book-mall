#!/usr/bin/env bash
# 将 Monorepo 子目录发布为独立 GitHub 仓库（供云托管「Git 仓库」下拉直接选 priceLiu/<name>）
#
# 用法：
#   ./scripts/publish-standalone-repo.sh finance-web
#   ./scripts/publish-standalone-repo.sh tool-web
#
# 前置：在 GitHub 已创建空仓库 https://github.com/priceLiu/<name>（无 README / 无 .gitignore）
set -euo pipefail

PROJECT="${1:-}"
if [[ -z "$PROJECT" || ! "$PROJECT" =~ ^(book-mall|tool-web|finance-web)$ ]]; then
  echo "用法: $0 <book-mall|tool-web|finance-web>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "须在 Git 仓库根目录执行" >&2
  exit 1
fi

BRANCH="publish/${PROJECT}"
REMOTE="https://github.com/priceLiu/${PROJECT}.git"

echo "==> 从 main 拆分子目录 ${PROJECT}/ -> 分支 ${BRANCH}"
git fetch origin main 2>/dev/null || true
git subtree split --prefix="${PROJECT}" -b "${BRANCH}"

echo "==> 推送到 ${REMOTE} (main)"
if git push "${REMOTE}" "${BRANCH}:main" --force; then
  echo "完成: ${REMOTE}"
  echo "云托管: Git 仓库选 priceLiu/${PROJECT}，目标目录留空（仓库根即应用根）"
else
  echo "" >&2
  echo "推送失败。请先在 GitHub 创建空仓库: ${REMOTE}" >&2
  echo "创建后重试: $0 ${PROJECT}" >&2
  exit 1
fi
