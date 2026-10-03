#!/usr/bin/env node
/**
 * pnpm file: 依赖会缓存 shared 快照；改 shared/ecom-copy-overlay 后需同步到各 app 的 node_modules，
 * 否则 Next 编译/运行会 500（Cannot find module ./layer-ops 等）。
 *
 * 用法：node scripts/sync-ecom-copy-overlay-deps.mjs
 * dev:all 在 pnpm install 之后会自动执行（见 package.json）。
 */
import { cpSync, existsSync, readdirSync, realpathSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "ecom-copy-overlay";
const SRC = join(ROOT, "shared", PKG);
const APPS = ["e-commerce-toolkit", "book-mall", "canvas-web"];

if (!existsSync(SRC)) {
  console.error("[sync-ecom-copy-overlay] missing", SRC);
  process.exit(1);
}

let copied = 0;
for (const app of APPS) {
  const dstLink = join(ROOT, app, "node_modules", "@private", PKG);
  if (!existsSync(dstLink)) {
    console.warn(`[sync-ecom-copy-overlay] skip ${app} (no node_modules/@private/${PKG})`);
    continue;
  }
  let dst = dstLink;
  try {
    dst = realpathSync(dstLink);
  } catch {
    /* keep dstLink */
  }
  for (const name of readdirSync(SRC)) {
    if (name === "node_modules" || name === "pnpm-lock.yaml") continue;
    const from = join(SRC, name);
    if (!statSync(from).isFile()) continue;
    const to = join(dst, name);
    try {
      if (realpathSync(from) === realpathSync(to)) continue;
    } catch {
      /* dest may not exist yet */
    }
    try {
      cpSync(from, to, { force: true });
    } catch (err) {
      if (err && typeof err === "object" && err.code === "ERR_FS_CP_EINVAL") {
        try {
          unlinkSync(to);
        } catch {
          /* */
        }
        cpSync(from, to);
      } else {
        throw err;
      }
    }
    copied += 1;
  }
  console.log(`[sync-ecom-copy-overlay] synced → ${app} (${dst})`);
}

console.log(`[sync-ecom-copy-overlay] done (${copied} file writes per app)`);
