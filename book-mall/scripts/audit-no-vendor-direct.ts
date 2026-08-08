/**
 * CI：禁止业务层 runtime 直连厂商（env API Key / vendor host）。
 *
 *   pnpm exec tsx scripts/audit-no-vendor-direct.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const SCAN_DIRS = [
  path.join(ROOT, "book-mall/lib/canvas"),
  path.join(ROOT, "book-mall/app/api/canvas"),
  path.join(ROOT, "canvas-web"),
];

const ALLOWLIST_PREFIXES = [
  "book-mall/lib/canvas/providers/",
  "book-mall/lib/canvas/canvas-system-provider.ts",
  "book-mall/lib/canvas/canvas-gateway-providers.ts",
  "book-mall/lib/canvas/canvas-video-bailian-r2v.ts",
  "book-mall/lib/canvas/canvas-constants.ts",
  "book-mall/lib/canvas/secret.ts",
  "canvas-web/app/settings/providers/providers-client.tsx",
  "canvas-web/app/auth/",
  "canvas-web/app/api/tools-session/",
  "canvas-web/lib/book-mall-proxy-auth.ts",
  "canvas-web/lib/portal-auth-bff.ts",
  "canvas-web/lib/tools-introspect.ts",
];

const VENDOR_ENV_RE =
  /process\.env\.(?:DEEPSEEK|MOONSHOT|BAILIAN|DASHSCOPE|KIE|VOLC|OPENAI|GEMINI|HUNYUAN|ARK|MINIMAX)[A-Z0-9_]*(?:API_KEY|SECRET)/g;
const VENDOR_HOST_RE =
  /https?:\/\/(?:api\.moonshot\.cn|dashscope\.aliyuncs\.com|api\.deepseek\.com|ark\.cn-beijing\.volces\.com)/g;

function rel(p: string): string {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function isAllowlisted(relPath: string): boolean {
  return ALLOWLIST_PREFIXES.some((p) => relPath.startsWith(p));
}

function main() {
  const violations: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const r = rel(file);
      if (isAllowlisted(r)) continue;
      const text = fs.readFileSync(file, "utf8");
      if (VENDOR_ENV_RE.test(text)) {
        violations.push(`${r}: runtime vendor API key env`);
      }
      VENDOR_ENV_RE.lastIndex = 0;
      if (VENDOR_HOST_RE.test(text) && !r.includes("test/") && !r.includes(".test.")) {
        violations.push(`${r}: hardcoded vendor host URL in active path`);
      }
      VENDOR_HOST_RE.lastIndex = 0;
    }
  }
  if (violations.length) {
    console.error(`✗ audit-no-vendor-direct 失败 (${violations.length}):`);
    for (const v of violations.slice(0, 40)) console.error(`  - ${v}`);
    if (violations.length > 40) console.error(`  … +${violations.length - 40} more`);
    process.exit(1);
  }
  console.log("✓ 未发现业务层直连厂商 env/host 违规（allowlist 除外）。");
}

main();
