#!/usr/bin/env node
/**
 * 将 story-web/public/video 下的 mp4 上传到 OSS（读取 tool-web/.env.local 凭证）。
 * 生成 src/shared/landing-videos.manifest.json 供首页「发现更多」使用。
 *
 * 用法（在 story-web 目录）：
 *   node scripts/upload-landing-videos-to-oss.mjs
 *   node scripts/upload-landing-videos-to-oss.mjs --force   # 已存在也重新上传
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const VIDEO_DIR = path.join(ROOT, "public", "video");
const MANIFEST_PATH = path.join(ROOT, "src", "shared", "landing-videos.manifest.json");
const OSS_PREFIX = "story-web/landing/video";
const ENV_FILE = path.join(ROOT, "..", "tool-web", ".env.local");

const require = createRequire(import.meta.url);
const OSS = require("../../tool-web/node_modules/ali-oss");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`未找到 env 文件：${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
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

  const files = fs
    .readdirSync(VIDEO_DIR)
    .filter((name) => /\.mp4$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.log("public/video 下无 mp4，跳过。");
    return;
  }

  const client = new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    region: cfg.region,
    authorizationV4: true,
    bucket: cfg.bucket,
    secure: true,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });

  const baseUrl =
    process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "") ||
    `https://${cfg.bucket}.${cfg.region}.aliyuncs.com`;

  const videos = [];
  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const key = `${OSS_PREFIX}/${file}`;
    const localPath = path.join(VIDEO_DIR, file);
    const stat = fs.statSync(localPath);
    const mb = (stat.size / (1024 * 1024)).toFixed(1);

    process.stdout.write(`[${i + 1}/${files.length}] ${file} (${mb} MB) … `);

    if (!force && (await objectExists(client, key))) {
      console.log("已存在，跳过");
      skipped++;
    } else {
      await client.put(key, localPath, {
        headers: { "Content-Type": "video/mp4" },
        ACL: "public-read",
      });
      console.log("已上传");
      uploaded++;
    }

    videos.push({
      id: file.replace(/\.[^.]+$/, ""),
      file,
      url: publicUrl(cfg, key),
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    prefix: OSS_PREFIX,
    videos,
  };

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`\n完成：上传 ${uploaded}，跳过 ${skipped}，共 ${videos.length} 条`);
  console.log(`Manifest → ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
