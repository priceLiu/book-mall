#!/usr/bin/env node
/**
 * 将 `public/image-editor/ai-gen-styles/*.jpg` 上传到 OSS（与运行时 `AI_GEN_STYLE_OSS_PREFIX` 一致）。
 *
 *   cd e-commerce-toolkit && node scripts/sync-ai-gen-style-thumbs-from-public.mjs
 *   node scripts/sync-ai-gen-style-thumbs-from-public.mjs --force
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECOM_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(ECOM_ROOT, "..");
const PUBLIC_DIR = path.join(ECOM_ROOT, "public", "image-editor", "ai-gen-styles");
const ENV_FILE = path.join(REPO_ROOT, "book-mall", ".env.local");
const OSS_KEY_PREFIX = "ecom/image-editor/ai-gen-styles";

const require = createRequire(import.meta.url);
const OSS = require(path.join(REPO_ROOT, "book-mall/node_modules/ali-oss"));

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
    throw new Error("缺少 OSS 凭证（book-mall/.env.local）");
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
  if (!fs.existsSync(PUBLIC_DIR)) {
    throw new Error(`目录不存在：${PUBLIC_DIR}`);
  }
  const files = fs.readdirSync(PUBLIC_DIR).filter((f) => f.endsWith(".jpg"));
  if (files.length === 0) throw new Error("public 中无 .jpg 缩略图");

  loadEnvFile(ENV_FILE);
  const cfg = readOssEnv();
  const client = new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket,
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });

  let n = 0;
  for (const file of files) {
    const id = file.replace(/\.jpg$/i, "");
    const key = `${OSS_KEY_PREFIX}/${id}.jpg`;
    if (!force && (await objectExists(client, key))) {
      n++;
      continue;
    }
    const buf = fs.readFileSync(path.join(PUBLIC_DIR, file));
    await client.put(key, buf, {
      headers: {
        "Content-Type": file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      },
    });
    n++;
    console.log(`已上传 ${key}`);
  }
  console.log(`完成：${n}/${files.length} → OSS ${OSS_KEY_PREFIX}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});