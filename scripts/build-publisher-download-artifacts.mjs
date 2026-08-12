#!/usr/bin/env node
/**
 * 构建一键发布 · 浏览器扩展 ZIP + macOS 桌面 ZIP，输出到 book-mall/public/downloads/
 *
 * 用法：node scripts/build-publisher-download-artifacts.mjs
 * 或：pnpm build:publisher-artifacts
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assemblePublisherDesktopMacApp } from "./assemble-publisher-desktop-mac.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "book-mall/public/downloads");
const extDir = join(root, "publisher-extension");
const desktopDir = join(root, "publisher-desktop");

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (${cwd})`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function zipDir(sourceDir, zipPath) {
  rmSync(zipPath, { force: true });
  run("zip", ["-r", zipPath, "."], sourceDir);
  const mb = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log(`  ✓ ${zipPath} (${mb} MB)`);
}

mkdirSync(outDir, { recursive: true });

// —— 1. 浏览器扩展 ——
const plasmoBin = join(extDir, "node_modules/.bin/plasmo");
if (!existsSync(plasmoBin)) {
  console.error("请先安装 publisher-extension 依赖：pnpm --dir publisher-extension install");
  process.exit(1);
}
run(plasmoBin, ["build"], extDir);

const extBuild = join(extDir, "build/chrome-mv3-prod");
if (!existsSync(extBuild)) {
  console.error("扩展构建失败：未找到 build/chrome-mv3-prod");
  process.exit(1);
}
zipDir(extBuild, join(outDir, "publisher-extension-chrome.zip"));

// —— 2. macOS 桌面端（esbuild 单文件打包 + 手动 .app 组装）——
const electronDist = join(desktopDir, "node_modules/electron/dist/Electron.app");
if (!existsSync(electronDist)) {
  console.log("下载 Electron 运行时…");
  run("node", [join(desktopDir, "node_modules/electron/install.js")], desktopDir);
}

run(
  "pnpm",
  ["dlx", "esbuild@0.25", "src/main.ts", "--bundle", "--platform=node", "--external:electron", "--outfile=dist/main.js"],
  desktopDir,
);
run(
  "pnpm",
  ["dlx", "esbuild@0.25", "src/preload.ts", "--bundle", "--platform=node", "--external:electron", "--outfile=dist/preload.js"],
  desktopDir,
);

const macZipPath = join(outDir, "publisher-desktop-mac.zip");
assemblePublisherDesktopMacApp(desktopDir, macZipPath);
const mb = (statSync(macZipPath).size / (1024 * 1024)).toFixed(1);
console.log(`  ✓ ${macZipPath} (${mb} MB)`);

console.log("\n完成。下载页将自动启用：");
console.log("  /downloads/publisher-extension-chrome.zip");
console.log("  /downloads/publisher-desktop-mac.zip");
