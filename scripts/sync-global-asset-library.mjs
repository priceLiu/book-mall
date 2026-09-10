#!/usr/bin/env node
/**
 * 全局资产库 GALD · docker-shared 同步
 *
 * 真源：e-commerce-toolkit/docker-shared/global-asset-library/
 * 副本：canvas-web、book-mall
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "e-commerce-toolkit/docker-shared/global-asset-library");
const TARGET_APPS = ["canvas-web", "book-mall"];

const FILES = [
  "types.ts",
  "theme.ts",
  "catalog-media-url.ts",
  "catalog-badge.tsx",
  "global-asset-library-dialog.tsx",
  "global-asset-tile.tsx",
  "global-asset-library-provider.tsx",
  "save-to-catalog-dialog.tsx",
  "index.ts",
];

const checkOnly = process.argv.includes("--check");
let drift = 0;
let wrote = 0;

for (const file of FILES) {
  const source = readFileSync(join(SOURCE, file), "utf8");
  for (const app of TARGET_APPS) {
    const dst = join(ROOT, app, "docker-shared/global-asset-library", file);
    let current = null;
    try {
      current = readFileSync(dst, "utf8");
    } catch {
      current = null;
    }
    if (current === source) continue;
    if (checkOnly) {
      drift += 1;
      console.error(`[sync-global-asset-library] DRIFT · ${app}/${file}`);
      continue;
    }
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, source);
    wrote += 1;
  }
}

if (checkOnly) {
  process.exit(drift > 0 ? 1 : 0);
}
console.log(`[sync-global-asset-library] wrote ${wrote} file(s)`);
