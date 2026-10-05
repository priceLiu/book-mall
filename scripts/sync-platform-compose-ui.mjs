#!/usr/bin/env node
/**
 * 平台简易剪辑台 UI 包 · 写入各子应用 docker-shared（CloudBase 子目录构建用）
 *
 * 真源：book-mall/platform-compose-ui/
 * 镜像内 package.json 为 file:../book-mall/platform-compose-ui → Dockerfile COPY 到 /book-mall/platform-compose-ui
 *
 *   node scripts/sync-platform-compose-ui.mjs
 *   node scripts/sync-platform-compose-ui.mjs --check
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "book-mall/platform-compose-ui");
const TARGET_APPS = ["e-commerce-toolkit", "canvas-web"];
const CHECK_ONLY = process.argv.includes("--check");

function dirFingerprint(dir) {
  const parts = [];
  function walk(p, prefix = "") {
    for (const name of readdirSync(p).sort()) {
      if (name === "node_modules") continue;
      const full = join(p, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, rel);
      else parts.push(`${rel}:${createHash("sha256").update(readFileSync(full)).digest("hex")}`);
    }
  }
  walk(dir);
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

if (!existsSync(join(SOURCE, "package.json"))) {
  console.error("[sync-platform-compose-ui] missing source:", SOURCE);
  process.exit(1);
}

const srcFp = dirFingerprint(SOURCE);
let drift = 0;

for (const app of TARGET_APPS) {
  const dst = join(ROOT, app, "docker-shared/platform-compose-ui");
  if (!existsSync(join(dst, "package.json"))) {
    drift += 1;
    if (CHECK_ONLY) {
      console.error(`[sync-platform-compose-ui] MISSING ${app}/docker-shared/platform-compose-ui`);
    } else {
      rmSync(dst, { recursive: true, force: true });
      cpSync(SOURCE, dst, { recursive: true });
      console.log(`[sync-platform-compose-ui] synced → ${app}/docker-shared/platform-compose-ui`);
    }
    continue;
  }
  const dstFp = dirFingerprint(dst);
  if (srcFp !== dstFp) {
    drift += 1;
    if (CHECK_ONLY) {
      console.error(`[sync-platform-compose-ui] DRIFT ${app}/docker-shared/platform-compose-ui`);
    } else {
      rmSync(dst, { recursive: true, force: true });
      cpSync(SOURCE, dst, { recursive: true });
      console.log(`[sync-platform-compose-ui] updated ${app}/docker-shared/platform-compose-ui`);
    }
  }
}

if (CHECK_ONLY) {
  if (drift > 0) {
    console.error("Run `pnpm sync:platform-compose-ui` before commit / Docker build.");
    process.exit(1);
  }
  console.log("[sync-platform-compose-ui] OK · e-commerce-toolkit + canvas-web");
} else if (drift === 0) {
  console.log("[sync-platform-compose-ui] already up to date");
}
