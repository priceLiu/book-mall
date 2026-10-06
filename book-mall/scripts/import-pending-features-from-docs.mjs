#!/usr/bin/env node
/**
 * 从 monorepo docs/ 导入 .md 到 AdminPendingFeature（与后台「从 docs 导入」同逻辑）
 * 用法：cd book-mall && node scripts/import-pending-features-from-docs.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bookMallRoot = path.dirname(fileURLToPath(new URL("../", import.meta.url)));
const r = spawnSync(
  "pnpm",
  ["exec", "tsx", "scripts/import-pending-features-from-docs.ts"],
  { cwd: bookMallRoot, stdio: "inherit", env: process.env },
);
process.exit(r.status ?? 1);
