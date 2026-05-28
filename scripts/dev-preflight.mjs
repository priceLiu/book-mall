#!/usr/bin/env node
/**
 * dev:all 启动前的端口预检：
 *   - 检查 3000-3005 是否被占
 *   - 如果有占用：打印占用 PID + 命令名，并给出处置建议（kill 命令），随后退出 1
 *   - 全空闲：静默通过
 *
 * 设计目标：避免 concurrently -k 在某个端口冲突时把其它 6 个进程一起 SIGTERM 拉死，
 * 让用户能一眼看到症结。
 *
 * 用法：node scripts/dev-preflight.mjs
 *   或：node scripts/dev-preflight.mjs --kill   # 自动 kill -9 占用进程后再退出 0（仅限 macOS / Linux）
 */
import { execFileSync } from "node:child_process";

const PORTS = [
  { port: 3000, label: "book-mall" },
  { port: 3001, label: "tool-web" },
  { port: 3002, label: "finance-web" },
  { port: 3003, label: "story-web" },
  { port: 3004, label: "canvas-web" },
  { port: 3005, label: "gateway-web" },
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

if (conflicts.length === 0) {
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
