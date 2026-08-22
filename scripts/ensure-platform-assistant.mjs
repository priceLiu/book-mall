#!/usr/bin/env node
/**
 * file: 依赖在 pnpm install 时快照复制；shared/platform-assistant 新增文件后，
 * 部分子应用 node_modules 可能缺 platform-apps.ts / ai-news-prefetch.ts。
 * dev:all 启动前补齐，避免 Next 编译 Module not found。
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "shared/platform-assistant");

const REQUIRED = [
  "platform-apps.ts",
  "ai-news-prefetch.ts",
  "greeting.ts",
  "index.ts",
  "platform-assistant.tsx",
  "package.json",
];

const APP_DIRS = [
  "book-mall",
  "canvas-web",
  "story-web",
  "tool-web",
  "gateway-web",
  "finance-web",
  "quick-replica-web",
  "e-commerce-toolkit",
  "common-tools",
  "publisher-web",
];

function findPlatformAssistantDirs(appDir) {
  const base = join(root, appDir, "node_modules");
  if (!existsSync(base)) return [];

  const hits = [];
  const pnpmDir = join(base, ".pnpm");
  if (!existsSync(pnpmDir)) return hits;

  for (const entry of readdirSync(pnpmDir)) {
    if (!entry.startsWith("@private+platform-assistant@file")) continue;
    const target = join(
      pnpmDir,
      entry,
      "node_modules/@private/platform-assistant",
    );
    if (existsSync(target) && statSync(target).isDirectory()) {
      hits.push(target);
    }
  }

  const direct = join(base, "@private/platform-assistant");
  if (existsSync(direct) && statSync(direct).isDirectory()) {
    hits.push(direct);
  }

  return hits;
}

function needsRefresh(targetDir) {
  for (const name of REQUIRED) {
    const p = join(targetDir, name);
    if (!existsSync(p)) return true;
    try {
      const src = readFileSync(join(srcDir, name));
      const dst = readFileSync(p);
      if (!src.equals(dst)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

let patched = 0;

for (const app of APP_DIRS) {
  for (const targetDir of findPlatformAssistantDirs(app)) {
    if (!needsRefresh(targetDir)) continue;
    for (const name of REQUIRED) {
      cpSync(join(srcDir, name), join(targetDir, name));
    }
    patched += 1;
    console.info(
      `[ensure-platform-assistant] refreshed ${app} → ${targetDir.replace(root + "/", "")}`,
    );
  }
}

if (patched === 0) {
  console.info("[ensure-platform-assistant] all copies up to date");
}
