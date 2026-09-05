#!/usr/bin/env node
/**
 * 复制 shared/platform-billing → 各子应用 lib/platform-billing/
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "shared/platform-billing");
const TARGET_APPS = [
  "canvas-web",
  "story-web",
  "tool-web",
  "e-commerce-toolkit",
  "quick-replica-web",
  "finance-web",
  "publisher-web",
  "common-tools",
];

const header =
  "/** @generated — 勿手改；改 shared/platform-billing 后运行 node scripts/sync-platform-billing.mjs */\n\n";

for (const app of TARGET_APPS) {
  const dir = join(ROOT, app, "lib/platform-billing");
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(SOURCE_DIR)) {
    if (!/\.tsx?$/.test(name)) continue;
    const source = readFileSync(join(SOURCE_DIR, name), "utf8");
    writeFileSync(join(dir, name), header + source);
    console.log(`wrote ${app}/lib/platform-billing/${name}`);
  }
}
