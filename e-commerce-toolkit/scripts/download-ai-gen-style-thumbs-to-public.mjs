#!/usr/bin/env node
/**
 * 下载风格缩略图到本站静态目录（dev/建站即用；生产可再 sync-ai-gen-style-thumbs.mjs 上传 OSS）。
 *
 *   cd e-commerce-toolkit && node scripts/download-ai-gen-style-thumbs-to-public.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(__dirname, "ai-gen-style-thumb-sources.json");
const OUT_DIR = path.join(__dirname, "..", "public", "image-editor", "ai-gen-styles");

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`缺少 ${MANIFEST}，请先运行生成脚本或手写清单`);
  }
  /** @type {Array<{ id: string; sourceUrl: string }>} */
  const rows = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const { id, sourceUrl } of rows) {
    const dest = path.join(OUT_DIR, `${id}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      ok++;
      continue;
    }
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(`跳过 ${id}: HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    ok++;
    process.stdout.write(`.\n`);
  }
  console.log(`完成：${ok}/${rows.length} → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});