#!/usr/bin/env node
/**
 * 根目录 pnpm dev:all / dev:all:nopoll 的统一进程表（含 e-commerce-toolkit :3007）。
 *
 * 启动顺序：book-mall 立即起 → 其余子站等 mall HTTP 就绪后再启（--stagger 时间隔错峰）。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const waitMallScript = resolve(root, "scripts/dev-all-wait-mall.mjs");
const withPoll = !process.argv.includes("--no-poll");
const withStagger = process.argv.includes("--stagger");
const staggerSec = (() => {
  const raw = process.env.DEV_ALL_STAGGER_SEC?.trim();
  const n = raw ? Number(raw) : 3;
  return Number.isFinite(n) && n >= 0 ? n : 3;
})();
/** mall 就绪后，poll-loop 再额外等待（秒），避免与首波 SSO 抢连接池 */
const pollSettleSec = (() => {
  const raw = process.env.DEV_ALL_POLL_SETTLE_SEC?.trim();
  const n = raw ? Number(raw) : 5;
  return Number.isFinite(n) && n >= 0 ? n : 5;
})();

function shellDelay(seconds, cmd) {
  if (seconds <= 0) return cmd;
  return `sleep ${seconds} && ${cmd}`;
}

/** mall 先单独启动；其余子站先 wait-mall 再 dev（可选错峰 sleep） */
function webAppCommand(app, index) {
  const devCmd = `pnpm --dir ${app.dir} dev`;
  if (app.name === "mall") return devCmd;
  const staggerDelay = withStagger ? staggerSec * (index - 1) : 0;
  return `${process.execPath} ${waitMallScript} && ${shellDelay(staggerDelay, devCmd)}`;
}

function pollCommand(pollCmd) {
  return `${process.execPath} ${waitMallScript} && ${shellDelay(pollSettleSec, pollCmd)}`;
}

const WEB_APPS = [
  { name: "mall", dir: "book-mall", color: "blue" },
  { name: "tool", dir: "tool-web", color: "green" },
  { name: "finance", dir: "finance-web", color: "yellow" },
  { name: "story", dir: "story-web", color: "magenta" },
  { name: "canvas", dir: "canvas-web", color: "cyan" },
  { name: "gateway", dir: "gateway-web", color: "white" },
  { name: "prompt", dir: "prompt-optimizer-platform", color: "brightCyan" },
  { name: "replica", dir: "quick-replica-web", color: "brightMagenta" },
  { name: "ecom", dir: "e-commerce-toolkit", color: "blueBright" },
  { name: "director", dir: "director-web", color: "greenBright" },
  { name: "common", dir: "common-tools", color: "cyanBright" },
  { name: "publisher", dir: "publisher-web", color: "magentaBright" },
];

const POLL_LOOPS = [
  {
    name: "story-poll",
    color: "red",
    cmd: "pnpm --dir book-mall run story:poll-loop",
  },
  {
    name: "canvas-poll",
    color: "gray",
    cmd: "pnpm --dir book-mall run canvas:poll-loop",
  },
  {
    name: "gateway-poll",
    color: "gray",
    cmd: "pnpm --dir book-mall run gateway:poll-loop",
  },
];

function printBanner() {
  const hub = withPoll
    ? "开发导航 (含 Web + poll-loop 状态)"
    : "开发导航 (未含 poll-loop)";
  console.log(`
  >>> ${hub}: http://localhost:3000/dev
  >>> 电商工具箱: http://localhost:3007
  >>> 常用工具: http://localhost:3010
  >>> 电商 SSO 入口: http://localhost:3000/ecom-open?path=/
  >>> 常用工具 SSO: http://localhost:3000/common-tools-open?path=/
  >>> 漫剧任务看板: http://localhost:3000/dev/story/tasks
  >>> 画布任务看板: http://localhost:3000/dev/canvas/tasks
  >>> Gateway BYOK: http://localhost:3005
  >>> 子站: book-mall :3000  tool-web :3001  finance-web :3002  story-web :3003
         canvas-web :3004  gateway-web :3005  prompt-optimizer :3006  e-commerce-toolkit :3007
         quick-replica-web :3008  director-web :3009  common-tools :3010  publisher-web :3011
${withPoll ? "  >>> 后台 poll-loop 已启动；/dev 页可看心跳。\n" : "  >>> 未启动 poll-loop（--no-poll）；KIE 任务可能一直停留在生成中。\n"}  >>> 启动顺序：book-mall 先起 → HTTP 就绪后再等 20s → 启其余子站${withStagger ? `（间隔 ${staggerSec}s）` : "（并行）"}
`);
}

printBanner();

const names = [];
const colors = [];
const commands = [];

for (let i = 0; i < WEB_APPS.length; i++) {
  const app = WEB_APPS[i];
  names.push(app.name);
  colors.push(app.color);
  commands.push(webAppCommand(app, i));
}

if (withPoll) {
  for (const poll of POLL_LOOPS) {
    names.push(poll.name);
    colors.push(poll.color);
    commands.push(pollCommand(poll.cmd));
  }
}

const args = [
  "-n",
  names.join(","),
  "-c",
  colors.join(","),
  ...commands,
];

const concurrentlyBin = resolve(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "concurrently.cmd" : "concurrently",
);
if (!existsSync(concurrentlyBin)) {
  console.error(
    "\n缺少 concurrently：请在仓库根目录执行 pnpm install\n",
  );
  process.exit(1);
}

const child = spawn(concurrentlyBin, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    /** 子进程非交互；poll-loop 等脚本依赖 */
    CI: process.env.CI ?? "1",
    /** 本地 dev 勿连 registry.npmjs.org 查 Next 版本（弱网/超时会刷 TypeError: fetch failed） */
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
  },
});

const readyScript = resolve(root, "scripts/dev-all-ready.mjs");
const readyArgs = [
  `--stagger-sec=${staggerSec}`,
  `--poll-settle-sec=${pollSettleSec}`,
];
if (withStagger) readyArgs.push("--stagger");
if (!withPoll) readyArgs.push("--no-poll");

const readyChild = spawn(process.execPath, [readyScript, ...readyArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

readyChild.on("error", (err) => {
  console.warn("[dev-all] 就绪探测未启动:", err.message);
});

child.on("exit", (code) => {
  readyChild.kill("SIGTERM");
  process.exit(code ?? 0);
});
