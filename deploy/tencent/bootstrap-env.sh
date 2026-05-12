#!/usr/bin/env bash
# 首次部署：从 example 生成 deploy/tencent/*.env（若尚不存在）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p deploy/tencent
for pair in book-mall tool-web; do
  ex="deploy/tencent/${pair}.env.example"
  out="deploy/tencent/${pair}.env"
  if [[ ! -f "$out" ]]; then
    cp "$ex" "$out"
    echo "已创建 $out（请编辑填入真实配置）"
  else
    echo "已存在 $out，跳过"
  fi
done
echo "完成后执行: docker compose build && docker compose up -d"
