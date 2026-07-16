#!/usr/bin/env node
/**
 * dev:all 启动前的端口预检：
 *   - 检查 3000-3007 是否被占
 *   - 若 DATABASE_URL 走 127.0.0.1:6432，检查 PgBouncer 是否在监听
 *   - 如果有占用：打印占用 PID + 命令名，并给出处置建议（kill 命令），随后退出 1
 *   - 全空闲：静默通过
 *
 * 设计目标：避免 concurrently -k 在某个端口冲突时把其它子进程一起 SIGTERM 拉死，
 * 让用户能一眼看到症结。
 *
 * 用法：node scripts/dev-preflight.mjs
 *   或：node scripts/dev-preflight.mjs --kill   # 自动 kill -9 占用进程后再退出 0（仅限 macOS / Linux）
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const PORTS = [
  { port: 3000, label: "book-mall" },
  { port: 3001, label: "tool-web" },
  { port: 3002, label: "finance-web" },
  { port: 3003, label: "story-web" },
  { port: 3004, label: "canvas-web" },
  { port: 3005, label: "gateway-web" },
  { port: 3006, label: "prompt-optimizer-platform" },
  { port: 3007, label: "e-commerce-toolkit" },
  { port: 3008, label: "quick-replica-web" },
];

function listListenersOnPort(port) {
  try {
    const out = execFileSync(
      "lsof",
      ["-nP", "-iTCP:" + port, "-sTCP:LISTEN", "-Fpc"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const procs = [];
    let cur = null;
    for (const line of out.split("\n")) {
      if (line.startsWith("p")) {
        if (cur) procs.push(cur);
        cur = { pid: Number(line.slice(1)), command: "?" };
      } else if (line.startsWith("c") && cur) {
        cur.command = line.slice(1);
      }
    }
    if (cur) procs.push(cur);
    return procs;
  } catch {
    return [];
  }
}

const conflicts = [];
for (const item of PORTS) {
  const procs = listListenersOnPort(item.port);
  if (procs.length > 0) {
    conflicts.push({ ...item, procs });
  }
}

function checkFfmpegForDev() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 5000 });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** 从 book-mall/.env.local 解析 DATABASE_URL（不打印密钥） */
function parseDatabaseUrlFromEnvLocal() {
  const envPath = join(ROOT, "book-mall/.env.local");
  if (!existsSync(envPath)) return null;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let raw = trimmed.slice(eq + 1).trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function tcpPortOpen(host, port) {
  try {
    execFileSync("nc", ["-z", host, String(port)], {
      stdio: "ignore",
      timeout: 4000,
    });
    return true;
  } catch {
    return false;
  }
}

/** DATABASE_URL 指向本地 PgBouncer 但未启动时，Prisma 会重试后整页 500 / 极慢 */
function checkDatabasePreflight() {
  const url = parseDatabaseUrlFromEnvLocal();
  if (!url) return true;

  const host = url.hostname;
  const port = url.port || "5432";
  const usesPool =
    port === "6432" || url.searchParams.get("pgbouncer") === "true";
  if (usesPool && (host === "127.0.0.1" || host === "localhost")) {
    if (tcpPortOpen(host, port)) return true;

    const RED = "\x1b[31m";
    const YEL = "\x1b[33m";
    const GRN = "\x1b[32m";
    const RST = "\x1b[0m";
    console.error(
      `\n${RED}✗ 数据库预检未通过${RST} — \`book-mall/.env.local\` 的 DATABASE_URL 指向 ` +
        `${YEL}${host}:${port}${RST}（PgBouncer），但本机该端口未监听。\n` +
        `  这会导致画布/登录等 API 极慢并在 prisma 重试后报 500。\n\n` +
        `处置（二选一）：\n` +
        `  ${GRN}A) 启动本地 PgBouncer${RST}：${GRN}./deploy/tencent/pgbouncer/start-local.sh${RST} 后 ${GRN}pnpm dev:all:clean${RST}\n` +
        `     （需 Docker/Colima 可用；macOS brew 版连远程 CDB 可能仍失败）\n` +
        `  ${GRN}B) 本地直连 CDB${RST}：将 DATABASE_URL 改为与 DIRECT_DATABASE_URL 相同的主机:24155，\n` +
        `     去掉 pgbouncer=true，追加 connection_limit=30&pool_timeout=30\n`,
    );
    return false;
  }

  if (host !== "127.0.0.1" && host !== "localhost") {
    if (!tcpPortOpen(host, port)) {
      const YEL = "\x1b[33m";
      const GRN = "\x1b[32m";
      const RST = "\x1b[0m";
      console.warn(
        `\n${YEL}⚠ 远程数据库 TCP 不可达${RST} — ${YEL}${host}:${port}${RST}\n` +
          `  本地开发若使用腾讯云 CDB，通常需先连接 VPN；否则生图/登录等会失败或极慢。\n` +
          `  自检：${GRN}pnpm --dir book-mall db:ping${RST}  ·  详见 ${GRN}docs/dev.md${RST} §数据库连接\n`,
      );
    }
  }

  return true;
}

if (conflicts.length === 0) {
  if (!checkDatabasePreflight()) {
    process.exit(1);
  }
  if (!checkFfmpegForDev()) {
    const YEL = "\x1b[33m";
    const GRN = "\x1b[32m";
    const RST = "\x1b[0m";
    console.warn(
      `\n${YEL}⚠ ffmpeg 未安装 — 云端自动剪辑不可用（终端用户无需安装，仅本机 book-mall 需要）${RST}\n` +
        `  一键安装：${GRN}cd book-mall && pnpm media-render:setup-ffmpeg${RST}\n` +
        `  或手动：  ${GRN}brew install ffmpeg${RST} 后重启 dev:all\n`,
    );
  }
  process.exit(0);
}

const shouldKill = process.argv.includes("--kill");

const RED = "\x1b[31m";
const YEL = "\x1b[33m";
const GRN = "\x1b[32m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

console.error(
  `\n${RED}✗ dev:all 端口预检未通过${RST} —— 以下端口已被占用：\n`,
);
for (const c of conflicts) {
  for (const p of c.procs) {
    console.error(
      `  ${YEL}:${c.port}${RST} (${c.label})  pid=${p.pid}  ${DIM}${p.command}${RST}`,
    );
  }
}

if (shouldKill) {
  console.error(`\n${YEL}⚠ 检测到 --kill：将对上述 PID 发 SIGKILL${RST}`);
  for (const c of conflicts) {
    for (const p of c.procs) {
      try {
        process.kill(p.pid, "SIGKILL");
        console.error(`  ${GRN}✓ killed${RST} pid=${p.pid}`);
      } catch (e) {
        console.error(`  ${RED}✗ kill failed${RST} pid=${p.pid}: ${e.message}`);
      }
    }
  }
  process.exit(0);
}

console.error(
  `\n处置建议：\n` +
    `  1) 自动清理（推荐）： ${GRN}pnpm dev:all:clean${RST}（=本脚本 --kill 后再起 dev:all）\n` +
    `  2) 手动清理：           ${GRN}kill ${conflicts
      .flatMap((c) => c.procs.map((p) => p.pid))
      .join(" ")}${RST}\n` +
    `  3) 看是哪个进程：       ${GRN}lsof -nP -iTCP:3004 -sTCP:LISTEN${RST}\n`,
);
process.exit(1);
