#!/usr/bin/env node
/**
 * 清除 dev:all 各 Next 子应用的 .next 编译缓存。
 * 修复：Cannot find module './NNNNN.js'、useContext null（常与 dev 运行中 next build 或 HMR 损坏缓存有关）。
 *
 * 用法：
 *   node scripts/dev-reset-next-caches.mjs           # 全部子站
 *   node scripts/dev-reset-next-caches.mjs book-mall # 仅指定目录
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WEB_APPS = [
  "book-mall",
  "tool-web",
  "finance-web",
  "story-web",
  "canvas-web",
  "gateway-web",
  "prompt-optimizer-platform",
  "quick-replica-web",
  "e-commerce-toolkit",
  "director-web",
  "common-tools",
  "publisher-web",
];

const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = filter.length
  ? filter.filter((d) => WEB_APPS.includes(d))
  : WEB_APPS;

if (filter.length && targets.length !== filter.length) {
  const unknown = filter.filter((d) => !WEB_APPS.includes(d));
  console.warn("[dev-reset-next-caches] unknown app dirs:", unknown.join(", "));
}

let removed = 0;
for (const dir of targets) {
  const nextDir = join(ROOT, dir, ".next");
  if (!existsSync(nextDir)) continue;
  rmSync(nextDir, { recursive: true, force: true });
  removed += 1;
  console.info(`[dev-reset-next-caches] removed ${dir}/.next`);
}

if (removed === 0) {
  console.info("[dev-reset-next-caches] no .next directories to remove");
} else {
  console.info(
    `[dev-reset-next-caches] done (${removed} app(s)) — restart dev:all`,
  );
}
