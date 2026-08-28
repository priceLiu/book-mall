#!/usr/bin/env node
/**
 * 根目录 pnpm dev:all / dev:all:nopoll 的统一进程表（含 e-commerce-toolkit :3007）。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const withPoll = !process.argv.includes("--no-poll");

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
${withPoll ? "  >>> 后台 poll-loop 已启动；/dev 页可看心跳。\n" : "  >>> 未启动 poll-loop（--no-poll）；KIE 任务可能一直停留在生成中。\n"}`);
}

printBanner();

const names = [];
const colors = [];
const commands = [];

for (const app of WEB_APPS) {
  names.push(app.name);
  colors.push(app.color);
  commands.push(`pnpm --dir ${app.dir} dev`);
}

if (withPoll) {
  for (const poll of POLL_LOOPS) {
    names.push(poll.name);
    colors.push(poll.color);
    commands.push(poll.cmd);
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

child.on("exit", (code) => process.exit(code ?? 0));
