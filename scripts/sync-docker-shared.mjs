#!/usr/bin/env node
/**
 * 同步各子应用 Docker 构建所需的 shared 包快照到 <app>/docker-shared。
 *
 * 背景：
 * - CloudBase 按 Monorepo 子目录构建时，构建上下文看不到仓库根 shared/。
 * - 各应用 package.json 使用 file:../shared/*，镜像内会解析到 /shared/*。
 * - 因此需要把 shared 包快照随应用目录一起提交，并在 Dockerfile COPY 到 /shared。
 *
 * 用法：
 *   node scripts/sync-docker-shared.mjs           # 写入/更新快照
 *   node scripts/sync-docker-shared.mjs --check   # 仅校验（CI 用）
 */
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");

/** 每个应用需要打包进 docker-shared 的 shared 子包列表 */
const APP_SHARED_MAP = {
  "book-mall": ["federated-portal-nav", "platform-assistant"],
  "canvas-web": ["federated-portal-nav", "platform-assistant"],
  "story-web": ["federated-portal-nav", "platform-assistant"],
  "common-tools": ["federated-portal-nav", "platform-assistant"],
  "quick-replica-web": ["federated-portal-nav", "platform-assistant"],
  "e-commerce-toolkit": [
    "federated-portal-nav",
    "platform-assistant",
    "publisher-client",
  ],
};

function listDirNames(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((ent) => ent.isDirectory())
    .map((ent) => ent.name)
    .sort();
}

let drift = 0;
let wrote = 0;

for (const [app, sharedPkgs] of Object.entries(APP_SHARED_MAP)) {
  const targetRoot = join(ROOT, app, "docker-shared");
  const expected = [...sharedPkgs].sort();
  const actual = listDirNames(targetRoot);
  const extra = actual.filter((name) => !expected.includes(name));
  const missing = expected.filter((name) => !actual.includes(name));

  if (extra.length || missing.length) {
    drift += extra.length + missing.length;
    if (CHECK_ONLY) {
      if (missing.length) {
        console.error(`[sync-docker-shared] MISSING ${app}: ${missing.join(", ")}`);
      }
      if (extra.length) {
        console.error(`[sync-docker-shared] EXTRA   ${app}: ${extra.join(", ")}`);
      }
    }
  }

  if (!CHECK_ONLY && extra.length) {
    for (const pkg of extra) {
      rmSync(join(targetRoot, pkg), { recursive: true, force: true });
      wrote += 1;
      console.log(`[sync-docker-shared] removed ${app}/docker-shared/${pkg}`);
    }
  }

  for (const pkg of sharedPkgs) {
    const src = join(ROOT, "shared", pkg);
    const dst = join(targetRoot, pkg);
    if (!existsSync(src)) {
      console.error(`[sync-docker-shared] source missing: shared/${pkg}`);
      drift += 1;
      continue;
    }
    if (CHECK_ONLY) continue;
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true });
    wrote += 1;
    console.log(`[sync-docker-shared] synced ${app}/docker-shared/${pkg}`);
  }
}

if (CHECK_ONLY) {
  if (drift > 0) {
    console.error("Run `node scripts/sync-docker-shared.mjs` to sync snapshots.");
    process.exit(1);
  }
  const appCount = Object.keys(APP_SHARED_MAP).length;
  const pkgCount = Object.values(APP_SHARED_MAP).reduce((n, list) => n + list.length, 0);
  console.log(`[sync-docker-shared] OK · ${appCount} apps / ${pkgCount} package snapshots`);
} else {
  console.log(`[sync-docker-shared] done · updated ${wrote} snapshots`);
}
