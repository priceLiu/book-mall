#!/usr/bin/env bash
# 本地 dev：起 PgBouncer，转发到腾讯云 CDB（与正式 transaction 池一致）。
# 优先 Docker；拉镜像失败时回退 Homebrew 本机进程。
# 用法（仓库根目录）: ./deploy/tencent/pgbouncer/start-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PG_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/book-mall/.env.local"
LOCAL_INI="/tmp/tool-mall-pgbouncer.ini"
LOCAL_PID="/tmp/tool-mall-pgbouncer.pid"
LOCAL_LOG="/tmp/tool-mall-pgbouncer.log"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请先配置 book-mall 数据库连接。" >&2
  exit 1
fi

echo "→ 从 DIRECT_DATABASE_URL 同步 userlist.txt …"
cd "$ROOT/book-mall"
pnpm exec dotenv -e .env.local -- node -e "
const fs = require('fs');
const raw = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!raw) throw new Error('DIRECT_DATABASE_URL / DATABASE_URL 未设置');
const u = new URL(raw);
const user = decodeURIComponent(u.username);
const pass = decodeURIComponent(u.password);
const out = '\"' + user + '\" \"' + pass + '\"\\n';
fs.writeFileSync('${PG_DIR}/userlist.txt', out);
console.log('userlist.txt OK (user=' + user + ', backend=' + u.hostname + ':' + u.port + ')');
"

RUNTIME_INI="$PG_DIR/pgbouncer.runtime.ini"

generate_runtime_ini() {
  local cdb_host cdb_port cdb_ip
  cdb_host="$(cd "$ROOT/book-mall" && pnpm exec dotenv -e .env.local -- node -e "
    const u = new URL(process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL);
    process.stdout.write(u.hostname);
  ")"
  cdb_port="$(cd "$ROOT/book-mall" && pnpm exec dotenv -e .env.local -- node -e "
    const u = new URL(process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL);
    process.stdout.write(u.port || '5432');
  ")"
  cdb_ip="$(dig +short "$cdb_host" 2>/dev/null | head -1 | tr -d '\n')"
  if [[ -z "$cdb_ip" ]]; then
    echo "无法解析 CDB 主机 $cdb_host。" >&2
    return 1
  fi
  echo "→ CDB 后端: $cdb_host ($cdb_ip):$cdb_port"
  sed -e "s|tool_mall = host=.*|tool_mall = host=${cdb_ip} port=${cdb_port} dbname=tool_mall|" \
    "$PG_DIR/pgbouncer.ini" > "$RUNTIME_INI"
  return 0
}

start_brew() {
  local bin cdb_host cdb_port cdb_ip
  bin="$(command -v pgbouncer || true)"
  if [[ -z "$bin" ]]; then
    echo "未找到 pgbouncer。请: brew install pgbouncer" >&2
    return 1
  fi
  if [[ -f "$LOCAL_PID" ]] && kill -0 "$(cat "$LOCAL_PID")" 2>/dev/null; then
    echo "→ 本机 PgBouncer 已在运行 (pid $(cat "$LOCAL_PID"))"
    if wait_ready; then
      print_done "brew"
      return 0
    fi
    kill "$(cat "$LOCAL_PID")" 2>/dev/null || true
    rm -f "$LOCAL_PID"
  fi
  if ! generate_runtime_ini; then return 1; fi
  sed \
    -e "s|auth_file = /etc/pgbouncer/userlist.txt|auth_file = ${PG_DIR}/userlist.txt|" \
    "$RUNTIME_INI" > "$LOCAL_INI"
  {
    echo "pidfile = $LOCAL_PID"
    echo "logfile = $LOCAL_LOG"
    echo "server_connect_timeout = 30"
    echo "min_pool_size = 0"
    echo "default_pool_size = 10"
    echo "verbose = 1"
  } >> "$LOCAL_INI"
  echo "→ 启动本机 PgBouncer (brew) …"
  "$bin" -d "$LOCAL_INI"
  if wait_ready; then
    print_done "brew"
    return 0
  fi
  echo "本机 PgBouncer 启动失败，日志: $LOCAL_LOG" >&2
  tail -20 "$LOCAL_LOG" 2>/dev/null || true
  return 1
}

print_done() {
  echo "PgBouncer 已就绪 :6432 ($1)"
  echo ""
  echo "确认 book-mall/.env.local:"
  echo "  DATABASE_URL → 127.0.0.1:6432 + pgbouncer=true"
  echo "  DIRECT_DATABASE_URL → 直连 CDB:24155（迁移用）"
  echo "改 env 后请重启: pnpm dev:all:clean"
}

wait_ready() {
  local pg_isready="/opt/homebrew/opt/libpq/bin/pg_isready"
  if [[ ! -x "$pg_isready" ]]; then
    pg_isready="$(command -v pg_isready || true)"
  fi
  local i
  for i in $(seq 1 30); do
    if [[ -n "$pg_isready" ]] && "$pg_isready" -h 127.0.0.1 -p 6432 -U aitools_admin -d tool_mall >/dev/null 2>&1; then
      return 0
    fi
    if nc -z 127.0.0.1 6432 >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if docker info >/dev/null 2>&1; then
  echo "→ docker compose up -d --build …"
  cd "$PG_DIR"
  chmod 644 "$PG_DIR/userlist.txt" "$PG_DIR/pgbouncer.ini" 2>/dev/null || true
  # 避免与 brew 本机进程抢 6432
  if [[ -f "$LOCAL_PID" ]] && kill -0 "$(cat "$LOCAL_PID")" 2>/dev/null; then
    kill "$(cat "$LOCAL_PID")" 2>/dev/null || true
    rm -f "$LOCAL_PID"
  fi
  if ! generate_runtime_ini; then
    echo "→ Docker 跳过（无法生成 runtime ini），回退 Homebrew …"
  elif docker compose up -d --build 2>&1; then
  echo "→ 等待 PgBouncer 就绪 …"
  for i in $(seq 1 30); do
    if docker compose exec -T pgbouncer nc -z 127.0.0.1 6432 >/dev/null 2>&1; then
      print_done "docker"
      exit 0
    fi
    sleep 1
  done
  echo "Docker 容器启动超时，查看: docker compose -f $PG_DIR/docker-compose.yml logs" >&2
  fi
  echo "→ Docker 不可用，回退 Homebrew 本机进程 …"
fi

start_brew
