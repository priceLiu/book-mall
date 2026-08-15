#!/usr/bin/env node
/**
 * 把图片预览的「缩放 + 平移」规范实现从 e-commerce-toolkit 逐字复制到其余子应用。
 *
 * 规范见 `.cursor/rules/image-preview-zoom-pan.mdc`。
 * 各子应用互不共享 tsconfig paths，也没有为此单开 workspace 包，
 * 故用复制 + 校验保证一致；这与 `book-mall/scripts/sync-story-styles.ts` 同一套路。
 *
 * 使用：
 *   node scripts/sync-image-zoom-pan.mjs           # 写入
 *   node scripts/sync-image-zoom-pan.mjs --check   # 仅校验（CI 用，不一致则非零退出）
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_APP = "e-commerce-toolkit";

/** 规范文件在每个应用里的相对路径必须一致，否则副本里的 import 会失配 */
const FILES = [
  "lib/media/use-image-zoom-pan.ts",
  "components/media/image-zoom-controls.tsx",
];

/** 已接入统一预览的子应用；新应用接入时加到这里 */
const TARGET_APPS = [
  "canvas-web",
  "story-web",
  "tool-web",
  "quick-replica-web",
];

const checkOnly = process.argv.includes("--check");
let drift = 0;
let wrote = 0;

for (const file of FILES) {
  const source = readFileSync(join(ROOT, SOURCE_APP, file), "utf8");
  for (const app of TARGET_APPS) {
    const dst = join(ROOT, app, file);
    let current = null;
    try {
      current = readFileSync(dst, "utf8");
    } catch {
      current = null;
    }
    if (current === source) continue;

    if (checkOnly) {
      drift += 1;
      console.error(
        `[sync-image-zoom-pan] DRIFT · ${app}/${file}${current === null ? " (missing)" : ""}`,
      );
      continue;
    }
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, source);
    wrote += 1;
    console.log(`[sync-image-zoom-pan] wrote ${app}/${file}`);
  }
}

if (drift > 0) {
  console.error("Run `node scripts/sync-image-zoom-pan.mjs` to update.");
  process.exit(1);
}
console.log(
  checkOnly
    ? `[sync-image-zoom-pan] OK · ${FILES.length} 个文件 × ${TARGET_APPS.length} 个应用`
    : `[sync-image-zoom-pan] done · 更新 ${wrote} 个文件`,
);
