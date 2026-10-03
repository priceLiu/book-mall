#!/usr/bin/env node
/**
 * 电商工具箱 dev 编译缓存重置（MODULE_NOT_FOUND / docker-shared 缺失后的常见修复）
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ECOM = join(ROOT, "e-commerce-toolkit");
const NEXT = join(ECOM, ".next");

execSync("node scripts/sync-ecom-copy-overlay-deps.mjs", { cwd: ROOT, stdio: "inherit" });
execSync("node scripts/sync-global-asset-library.mjs", { cwd: ROOT, stdio: "inherit" });

if (existsSync(NEXT)) {
  rmSync(NEXT, { recursive: true, force: true });
  console.log("[ecom-toolkit-dev-reset] removed e-commerce-toolkit/.next");
}

console.log("[ecom-toolkit-dev-reset] done — restart dev:all or pnpm --dir e-commerce-toolkit dev");
