/**
 * 本地开发：合并 .env.development / .env.local，并从 book-mall/.env.local 继承 SSO 密钥。
 */
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
if (!merged.ECOMMERCE_PUBLIC_ORIGIN?.trim()) {
  merged.ECOMMERCE_PUBLIC_ORIGIN = "http://localhost:3007";
}
if (!merged.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim()) {
  merged.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN = merged.ECOMMERCE_PUBLIC_ORIGIN;
}
if (!merged.NEXT_PUBLIC_BOOK_MALL_URL?.trim()) {
  merged.NEXT_PUBLIC_BOOK_MALL_URL = merged.MAIN_SITE_ORIGIN;
}

const secret = merged.TOOLS_SSO_SERVER_SECRET?.trim() ?? "";
if (secret.length < 16) {
  console.warn(
    "\n[e-commerce-toolkit] 警告: TOOLS_SSO_SERVER_SECRET 未配置或过短。\n" +
      "  请在 book-mall/.env.local 配置后与主站一致，或使用 e-commerce-toolkit/.env.local。\n" +
      `  已尝试读取: ${bookEnvPath}\n`,
  );
}

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "next", "dev", "-p", "3007"],
  { cwd: appRoot, env: merged, stdio: "inherit", shell: true },
);

child.on("exit", (code) => process.exit(code ?? 0));
