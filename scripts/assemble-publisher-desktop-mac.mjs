#!/usr/bin/env node
/**
 * 组装 macOS .app（不依赖 electron-packager，避免 pnpm 嵌套依赖问题）
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export function assemblePublisherDesktopMacApp(desktopDir, zipPath) {
  const electronApp = join(desktopDir, "node_modules/electron/dist/Electron.app");
  if (!existsSync(electronApp)) {
    throw new Error("缺少 Electron.app，请先运行 node node_modules/electron/install.js");
  }

  const appPath = join(desktopDir, "release/一键发布.app");
  rmSync(appPath, { recursive: true, force: true });
  cpSync(electronApp, appPath, { recursive: true });

  const appRes = join(appPath, "Contents/Resources/app");
  mkdirSync(appRes, { recursive: true });
  cpSync(join(desktopDir, "dist"), join(appRes, "dist"), { recursive: true });
  cpSync(join(desktopDir, "renderer"), join(appRes, "renderer"), { recursive: true });
  writeFileSync(
    join(appRes, "package.json"),
    JSON.stringify({ name: "publisher-desktop", version: "0.1.0", main: "dist/main.js" }, null, 2),
  );

  const plistPath = join(appPath, "Contents/Info.plist");
  if (existsSync(plistPath)) {
    let plist = readFileSync(plistPath, "utf8");
    plist = plist.replace(/Electron/g, "一键发布");
    plist = plist.replace(/com\.github\.Electron/g, "com.aicode8.publisher-desktop");
    writeFileSync(plistPath, plist);
  }

  rmSync(zipPath, { force: true });
  const r = spawnSync("zip", ["-r", zipPath, "一键发布.app"], {
    cwd: join(desktopDir, "release"),
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error(`zip 失败 (${r.status})`);
  }
}
