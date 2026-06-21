/* eslint-disable no-console */
/**
 * 从 OpenArt 下载视频预览图 + mp4、上传 OSS，并生成 builtin-video-gallery.json。
 *
 * 准备：book-mall/content/quick-replica/video-gallery-seed.json
 * 环境：book-mall/.env.local 中 OSS_* / OSS_PUBLIC_URL_BASE
 *
 * 使用：
 *   cd book-mall && pnpm qr:sync-video-gallery
 *   pnpm qr:sync-video-gallery --dry-run
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { uploadQuickReplicaBuiltinPreview } from "../lib/canvas/canvas-oss";
import type { QrTemplateJson } from "../lib/quick-replica/qr-types";

const ROOT = resolve(__dirname, "..");
const SEED_JSON = resolve(ROOT, "content", "quick-replica", "video-gallery-seed.json");
const OUT_JSON = resolve(ROOT, "content", "quick-replica", "builtin-video-gallery.json");
const URLS_JSON = resolve(ROOT, "content", "quick-replica", "builtin-video-gallery.urls.json");

type SeedRow = {
  id: string;
  title: string;
  kind: string;
  thumbnailUrl: string;
  videoUrl: string;
};

function loadSeed(): SeedRow[] {
  const raw = readFileSync(SEED_JSON, "utf8");
  return JSON.parse(raw) as SeedRow[];
}

async function fetchBuffer(
  url: string,
  retries = 3,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const lower = url.toLowerCase();
      const ext = lower.endsWith(".webp")
        ? "webp"
        : lower.endsWith(".mp4")
          ? "mp4"
          : lower.endsWith(".png")
            ? "png"
            : "jpg";
      return { buf: Buffer.from(await res.arrayBuffer()), contentType, ext };
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw lastError;
}

function loadExistingTemplates(): QrTemplateJson[] {
  try {
    return JSON.parse(readFileSync(OUT_JSON, "utf8")) as QrTemplateJson[];
  } catch {
    return [];
  }
}

function buildTemplate(
  row: SeedRow,
  thumbnailUrl: string,
  videoUrl: string,
  sortOrder: number,
): QrTemplateJson {
  const now = "2026-06-20T00:00:00.000Z";
  return {
    schemaVersion: 1,
    id: row.id,
    category: "video",
    kind: "text-to-video",
    title: row.title,
    thumbnailUrl,
    source: "builtin",
    visibility: "public",
    reference: {
      slots: {},
      prompt: {
        text: row.title,
        locale: /[\u4e00-\u9fff]/.test(row.title) ? "zh" : "en",
      },
      model: {
        role: "VIDEO",
        modelKey: "grok-imagine/image-to-video",
        params: {},
      },
    },
    output: {
      mediaType: "video",
      url: videoUrl,
      createdAt: now,
    },
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const seed = loadSeed();
  const existing = force ? [] : loadExistingTemplates();
  const existingById = new Map(existing.map((t) => [t.id, t]));
  const urlMap: Record<string, { thumbnailUrl: string; videoUrl: string }> = {};
  for (const t of existing) {
    if (t.output?.url) {
      urlMap[t.id] = { thumbnailUrl: t.thumbnailUrl, videoUrl: t.output.url };
    }
  }
  const templates: QrTemplateJson[] = [...existing];
  let ok = existing.length;

  for (let i = 0; i < seed.length; i += 1) {
    const row = seed[i];
    const sortOrder = 100 + i;

    if (!force && existingById.has(row.id)) {
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${row.id} ← thumb + video`);
      templates.push(buildTemplate(row, row.thumbnailUrl, row.videoUrl, sortOrder));
      ok += 1;
      continue;
    }

    try {
      const thumb = await fetchBuffer(row.thumbnailUrl);
      const thumbOssUrl = await uploadQuickReplicaBuiltinPreview({
        id: row.id,
        buf: thumb.buf,
        contentType: thumb.contentType,
        ext: thumb.ext,
      });

      const video = await fetchBuffer(row.videoUrl);
      const videoOssUrl = await uploadQuickReplicaBuiltinPreview({
        id: `${row.id}-video`,
        buf: video.buf,
        contentType: video.contentType || "video/mp4",
        ext: video.ext,
      });

      urlMap[row.id] = { thumbnailUrl: thumbOssUrl, videoUrl: videoOssUrl };
      existingById.delete(row.id);
      templates.push(buildTemplate(row, thumbOssUrl, videoOssUrl, sortOrder));
      ok += 1;
      if (ok % 5 === 0) console.log(`[upload] ${ok}/${seed.length}`);
      console.log(`[ok] ${row.id} → ${thumbOssUrl}`);
    } catch (e) {
      console.error(`[fail] ${row.id}`, e);
    }
  }

  if (dryRun) {
    console.log(`[dry-run] would write ${templates.length} templates → ${OUT_JSON}`);
    return;
  }

  if (templates.length === 0) {
    console.error("[sync-quick-replica-video-gallery] no templates generated");
    process.exit(1);
  }

  templates.sort((a, b) => a.sortOrder - b.sortOrder);

  writeFileSync(OUT_JSON, JSON.stringify(templates, null, 2) + "\n");
  writeFileSync(URLS_JSON, JSON.stringify(urlMap, null, 2) + "\n");
  console.log(
    `[sync-quick-replica-video-gallery] done · seed=${seed.length} saved=${templates.length} → ${OUT_JSON}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
