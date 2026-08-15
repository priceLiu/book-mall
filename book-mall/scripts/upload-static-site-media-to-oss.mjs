#!/usr/bin/env node
/**
 * 主站首屏 Hero、tool-web Visual Lab 示例视频 → OSS（固定 key，可重复执行）。
 *
 *   cd book-mall && node scripts/upload-static-site-media-to-oss.mjs
 *   node scripts/upload-static-site-media-to-oss.mjs --force
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOK_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(BOOK_ROOT, "..");
const ENV_FILE = path.join(BOOK_ROOT, ".env.local");

const require = createRequire(import.meta.url);
const OSS = require("../node_modules/ali-oss");

/** @type {Array<{ local: string; key: string; contentType: string; multipart?: boolean }>} */
const ASSETS = [
  {
    local: path.join(REPO_ROOT, "tool-web/public/videos/qwen36-flash-ex2.mp4"),
    key: "tool-web/visual-lab/qwen36-flash-ex2.mp4",
    contentType: "video/mp4",
    multipart: true,
  },
];

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
    throw new Error("缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET");
  }
  return { accessKeyId, accessKeySecret, bucket, region, endpoint };
}

function publicUrl(cfg, key) {
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
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
  loadEnvFile(ENV_FILE);
  const cfg = readOssEnv();
  const client = new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    region: cfg.region,
    bucket: cfg.bucket,
    secure: true,
    timeout: 300_000,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });

  const urls = {};
  for (const asset of ASSETS) {
    if (!fs.existsSync(asset.local)) {
      console.warn(`跳过（本地不存在）: ${asset.local}`);
      continue;
    }
    const exists = await objectExists(client, asset.key);
    if (exists && !force) {
      console.log(`已存在，跳过: ${asset.key}`);
    } else {
      const buf = fs.readFileSync(asset.local);
      if (asset.multipart) {
        await client.multipartUpload(asset.key, buf, {
          parallel: 1,
          partSize: 1024 * 1024,
          timeout: 300_000,
          mime: asset.contentType,
          headers: { "x-oss-object-acl": "public-read" },
        });
      } else {
        await client.put(asset.key, buf, {
          headers: { "Content-Type": asset.contentType, "x-oss-object-acl": "public-read" },
        });
      }
      console.log(`已上传: ${asset.key} (${buf.length} bytes)`);
    }
    urls[asset.key] = publicUrl(cfg, asset.key);
  }

  console.log("\n公网 URL：");
  for (const [key, url] of Object.entries(urls)) {
    console.log(`  ${key}\n    → ${url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
