#!/usr/bin/env node
/**
 * 把 shared/platform-traffic 逐字复制到各子应用 lib/platform-traffic/。
 *
 *   node scripts/sync-platform-traffic.mjs
 *   node scripts/sync-platform-traffic.mjs --check
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "shared/platform-traffic");

const FILES = [
  "should-record-traffic-hit.ts",
  "classify-traffic-path.ts",
  "decode-tools-token-sub.ts",
  "book-mall-origin.ts",
  "traffic-ingest-secret.ts",
  "fire-traffic-hit.ts",
  "index.ts",
];

const TARGET_APPS = [
  "book-mall",
  "canvas-web",
  "story-web",
  "tool-web",
  "e-commerce-toolkit",
  "quick-replica-web",
  "prompt-optimizer-platform",
  "director-web",
  "common-tools",
  "publisher-web",
  "gateway-web",
  "finance-web",
];

const checkOnly = process.argv.includes("--check");
let drift = 0;

for (const file of FILES) {
  const source = readFileSync(join(SOURCE_DIR, file), "utf8");
  const header = `/** @generated — 勿在此编辑；改 shared/platform-traffic 后运行 node scripts/sync-platform-traffic.mjs */\n\n`;

  for (const app of TARGET_APPS) {
    const dir = join(ROOT, app, "lib/platform-traffic");
    const dst = join(dir, file);
    const expected = header + source;

    let current = null;
    try {
      current = readFileSync(dst, "utf8");
    } catch {
      current = null;
    }

    if (current === expected) continue;

    if (checkOnly) {
      console.error(`DRIFT: ${app}/lib/platform-traffic/${file}`);
      drift++;
      continue;
    }

    mkdirSync(dir, { recursive: true });
    writeFileSync(dst, expected);
    console.log(`wrote ${app}/lib/platform-traffic/${file}`);
  }
}

if (checkOnly && drift > 0) {
  process.exit(1);
}
