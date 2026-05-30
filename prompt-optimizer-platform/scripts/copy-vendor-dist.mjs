#!/usr/bin/env node
/**
 * 构建上游 Vue 应用并拷贝 dist 到 platform public/。
 * 需要 prompt-optimizer 已 pnpm install。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = path.join(root, "prompt-optimizer");
const distDir = path.join(vendorRoot, "packages/web/dist");
const publicDir = path.join(root, "public");

const env = {
  ...process.env,
  VITE_PLATFORM_GATEWAY: "1",
  VITE_GATEWAY_WEB_ORIGIN:
    process.env.VITE_GATEWAY_WEB_ORIGIN ?? "http://localhost:3005",
};

const skipBuild =
  process.argv.includes("--copy-only") ||
  process.env.COPY_VENDOR_SKIP_BUILD === "1";

if (!skipBuild) {
  console.log("[copy-vendor-dist] building prompt-optimizer (core → ui → web)…");
  for (const script of ["build:core", "build:ui", "build:web"]) {
    const build = spawnSync("pnpm", [script], {
      cwd: vendorRoot,
      stdio: "inherit",
      env,
    });
    if (build.status !== 0) {
      process.exit(build.status ?? 1);
    }
  }
} else {
  console.log("[copy-vendor-dist] skip build (--copy-only)");
}

if (!fs.existsSync(distDir)) {
  console.error(
    "[copy-vendor-dist] missing",
    distDir,
    "— run in Docker or: pnpm build:core && pnpm build:ui && pnpm build:web",
  );
  process.exit(1);
}

fs.mkdirSync(publicDir, { recursive: true });
for (const name of fs.readdirSync(publicDir)) {
  if (name === ".gitkeep") continue;
  fs.rmSync(path.join(publicDir, name), { recursive: true, force: true });
}

for (const name of fs.readdirSync(distDir)) {
  fs.cpSync(path.join(distDir, name), path.join(publicDir, name), {
    recursive: true,
  });
}

console.log("[copy-vendor-dist] copied to", publicDir);
