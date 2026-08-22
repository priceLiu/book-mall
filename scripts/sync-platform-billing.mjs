#!/usr/bin/env node
/**
 * 复制 shared/platform-billing → 各子应用 lib/platform-billing/
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "shared/platform-billing/build-checkout-href.ts");
const TARGET_APPS = [
  "canvas-web",
  "story-web",
  "tool-web",
  "e-commerce-toolkit",
  "quick-replica-web",
  "finance-web",
];

const header =
  "/** @generated — 勿手改；改 shared/platform-billing 后运行 node scripts/sync-platform-billing.mjs */\n\n";
const source = readFileSync(SOURCE, "utf8");

for (const app of TARGET_APPS) {
  const dir = join(ROOT, app, "lib/platform-billing");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "build-checkout-href.ts"), header + source);
  console.log(`wrote ${app}/lib/platform-billing/build-checkout-href.ts`);
}
