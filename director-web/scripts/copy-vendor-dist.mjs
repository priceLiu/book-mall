#!/usr/bin/env node
/**
 * 构建 3D导演台 Vite 应用（director-desk）并拷贝 dist 到 platform public/。
 * 首次或 vendor 变更后需先在 director-desk 内安装依赖（npm install）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = path.join(root, "director-desk");
const distDir = path.join(vendorRoot, "dist");
const publicDir = path.join(root, "public");

const skipBuild =
  process.argv.includes("--copy-only") ||
  process.env.COPY_VENDOR_SKIP_BUILD === "1";

if (!skipBuild) {
  console.log("[copy-vendor-dist] building director-desk (vite build)…");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: vendorRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
} else {
  console.log("[copy-vendor-dist] skip build (--copy-only)");
}

if (!fs.existsSync(distDir)) {
  console.error(
    "[copy-vendor-dist] missing",
    distDir,
    "— run in Docker or: cd director-desk && npm install && npm run build",
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
