#!/usr/bin/env node
/**
 * 本地开发：合并 .env.development / .env.local，并从 book-mall/.env.local 继承 SSO 与主站地址。
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEV_PORT = 3009;

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const bookEnvPath = resolve(appRoot, "../book-mall/.env.local");

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const merged = {
  ...process.env,
  ...parseEnvFile(resolve(appRoot, ".env.development")),
  ...parseEnvFile(resolve(appRoot, ".env.local")),
};

const book = parseEnvFile(bookEnvPath);
for (const key of [
  "TOOLS_SSO_SERVER_SECRET",
  "TOOLS_SSO_JWT_SECRET",
  "MAIN_SITE_ORIGIN",
  "BOOK_MALL_URL",
  "NEXT_PUBLIC_BOOK_MALL_URL",
]) {
  if (book[key]) merged[key] = book[key];
}

if (!merged.MAIN_SITE_ORIGIN?.trim()) {
  merged.MAIN_SITE_ORIGIN = "http://localhost:3000";
}
if (!merged.BOOK_MALL_URL?.trim()) {
  merged.BOOK_MALL_URL = merged.MAIN_SITE_ORIGIN;
}
if (!merged.NEXT_PUBLIC_BOOK_MALL_URL?.trim()) {
  merged.NEXT_PUBLIC_BOOK_MALL_URL = merged.MAIN_SITE_ORIGIN;
}
if (!merged.DIRECTOR_WEB_PUBLIC_ORIGIN?.trim()) {
  merged.DIRECTOR_WEB_PUBLIC_ORIGIN = "http://localhost:3009";
}
if (!merged.NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN?.trim()) {
  merged.NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN = merged.DIRECTOR_WEB_PUBLIC_ORIGIN;
}
if (!merged.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim()) {
  merged.NEXT_PUBLIC_CANVAS_WEB_ORIGIN = "http://localhost:3004";
}

const secret = merged.TOOLS_SSO_SERVER_SECRET?.trim() ?? "";
if (secret.length < 16) {
  console.warn(
    "\n[director-web] 警告: TOOLS_SSO_SERVER_SECRET 未配置或过短。\n" +
      "  请在 book-mall/.env.local 配置后与主站一致。\n" +
      `  已尝试读取: ${bookEnvPath}\n`,
  );
}

function listPortListeners(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const procs = [];
    let cur = null;
    for (const line of out.split("\n")) {
      if (line.startsWith("p")) {
        if (cur) procs.push(cur);
        cur = { pid: Number(line.slice(1)), command: "?" };
      } else if (line.startsWith("c") && cur) {
        cur.command = line.slice(1);
      }
    }
    if (cur) procs.push(cur);
    return procs;
  } catch {
    return [];
  }
}

const listeners = listPortListeners(DEV_PORT);
if (listeners.length > 0) {
  const detail = listeners.map((p) => `pid ${p.pid} (${p.command})`).join(", ");
  console.error(
    `\n[director-web] 端口 ${DEV_PORT} 已被占用: ${detail}\n` +
      "  · 若 dev:all 已在跑，请直接打开 http://localhost:3009\n" +
      "  · 若要重启全套：在仓库根目录执行 pnpm dev:preflight:kill 或 pnpm dev:all:clean\n" +
      "  · dev:all 下 director 会在 book-mall 就绪后再等约 20s 才出现 [director] 日志，勿过早 Ctrl+C\n",
  );
  process.exit(1);
}

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "next", "dev", `-p`, String(DEV_PORT)],
  { cwd: appRoot, env: merged, stdio: "inherit", shell: true },
);

child.on("exit", (code) => process.exit(code ?? 0));
