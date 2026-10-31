#!/usr/bin/env node
/**
 * file: 依赖在 pnpm install 时快照复制；shared/platform-assistant 新增文件后，
 * 部分子应用 node_modules 可能缺 platform-apps.ts / ai-news-prefetch.ts。
 * dev:all 启动前补齐，避免 Next 编译 Module not found。
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "shared/platform-assistant");

const REQUIRED = [
  "platform-apps.ts",
  "ai-news-prefetch.ts",
  "greeting.ts",
  "ai-news-format.ts",
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

function appDeclaresPlatformAssistant(appDir) {
  try {
    const pkg = JSON.parse(
      readFileSync(join(root, appDir, "package.json"), "utf8"),
    );
    return Boolean(pkg.dependencies?.["@private/platform-assistant"]);
  } catch {
    return false;
  }
}

/** pnpm 偶发未链接 file: 包时，在该应用目录执行 install（勿直链 shared，避免 React 双实例） */
function ensurePnpmPlatformAssistantLink(appDir) {
  if (!appDeclaresPlatformAssistant(appDir)) return null;
  const linkPath = join(root, appDir, "node_modules/@private/platform-assistant");
  if (existsSync(linkPath)) return linkPath;
  console.info(
    `[ensure-platform-assistant] missing link in ${appDir}, running pnpm install…`,
  );
  execSync("pnpm install", {
    cwd: join(root, appDir),
    stdio: "inherit",
    env: { ...process.env, CI: "true" },
  });
  return existsSync(linkPath) ? linkPath : null;
}

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
  const targetDirs = findPlatformAssistantDirs(app);
  if (!targetDirs.length) {
    const linked = ensurePnpmPlatformAssistantLink(app);
    if (linked) targetDirs.push(linked);
  }
  for (const targetDir of targetDirs) {
    if (!needsRefresh(targetDir)) continue;
    for (const name of REQUIRED) {
      const src = join(srcDir, name);
      const dest = join(targetDir, name);
      if (existsSync(dest)) {
        const srcStat = statSync(src);
        const destStat = statSync(dest);
        if (srcStat.dev === destStat.dev && srcStat.ino === destStat.ino) continue;
      }
      cpSync(src, dest);
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
