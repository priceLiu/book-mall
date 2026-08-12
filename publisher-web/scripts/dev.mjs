import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
if (!merged.PUBLISHER_WEB_PUBLIC_ORIGIN?.trim()) {
  merged.PUBLISHER_WEB_PUBLIC_ORIGIN = "http://localhost:3011";
}
if (!merged.NEXT_PUBLIC_PUBLISHER_WEB_ORIGIN?.trim()) {
  merged.NEXT_PUBLIC_PUBLISHER_WEB_ORIGIN = merged.PUBLISHER_WEB_PUBLIC_ORIGIN;
}
if (!merged.NEXT_PUBLIC_BOOK_MALL_URL?.trim()) {
  merged.NEXT_PUBLIC_BOOK_MALL_URL = merged.MAIN_SITE_ORIGIN;
}

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "next", "dev", "-p", "3011"],
  { cwd: appRoot, env: merged, stdio: "inherit", shell: true },
);

child.on("exit", (code) => process.exit(code ?? 0));
