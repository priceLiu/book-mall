#!/usr/bin/env node
/**
 * 将风格缩略图同步到 OSS：`ecom/image-editor/ai-gen-styles/{id}.jpg`
 *
 * 1. 复制 `ai-gen-style-thumb-sources.example.json` → `ai-gen-style-thumb-sources.json`
 * 2. 填写各风格的 `id`（与 lib/image-editor-ai-gen-style-models.ts 一致）与 `sourceUrl`
 * 3. 在 book-mall/.env.local 配置 OSS 凭证后执行：
 *
 *   cd e-commerce-toolkit && node scripts/sync-ai-gen-style-thumbs.mjs
 *   node scripts/sync-ai-gen-style-thumbs.mjs --force
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECOM_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(ECOM_ROOT, "..");
const MANIFEST = path.join(__dirname, "ai-gen-style-thumb-sources.json");
const ENV_FILE = path.join(REPO_ROOT, "book-mall", ".env.local");

const require = createRequire(import.meta.url);
const OSS = require(path.join(REPO_ROOT, "book-mall/node_modules/ali-oss"));

const OSS_KEY_PREFIX = "ecom/image-editor/ai-gen-styles";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`未找到 env：${filePath}`);
  }
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function readOssEnv() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();
  const bucket = process.env.OSS_BUCKET?.trim();
  const region = process.env.OSS_REGION?.trim() || "oss-cn-guangzhou";
  const endpoint = process.env.OSS_ENDPOINT?.trim();
  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error("缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET（book-mall/.env.local）");
  }
  return { accessKeyId, accessKeySecret, bucket, region, endpoint };
}

async function objectExists(client, key) {
  try {
    await client.head(key);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const force = process.argv.includes("--force");
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`请创建清单：${MANIFEST}（可参考 ai-gen-style-thumb-sources.example.json）`);
  }
  /** @type {Array<{ id: string; sourceUrl: string }>} */
  const rows = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("清单为空");
  }

  loadEnvFile(ENV_FILE);
  const cfg = readOssEnv();
  const client = new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket,
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });

  for (const row of rows) {
    const id = row.id?.trim();
    const sourceUrl = row.sourceUrl?.trim();
    if (!id || !sourceUrl) {
      console.warn("跳过无效行", row);
      continue;
    }
    const key = `${OSS_KEY_PREFIX}/${id}.jpg`;
    if (!force && (await objectExists(client, key))) {
      console.log(`跳过（已存在） ${key}`);
      continue;
    }
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`下载失败 ${id}: ${res.status} ${sourceUrl}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type")?.includes("png")
      ? "image/png"
      : "image/jpeg";
    await client.put(key, buf, { headers: { "Content-Type": contentType } });
    console.log(`已上传 ${key} (${buf.length} bytes)`);
  }
  console.log("完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});