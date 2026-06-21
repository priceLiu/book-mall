/* eslint-disable no-console */
/**
 * 从 OpenArt 参考图下载角色预览、上传 OSS，并生成 builtin-character-gallery.json。
 *
 * 准备：book-mall/content/quick-replica/character-gallery-seed.json
 * 环境：book-mall/.env.local 中 OSS_* / OSS_PUBLIC_URL_BASE
 *
 * 使用：
 *   cd book-mall && pnpm qr:sync-character-gallery
 *   pnpm qr:sync-character-gallery --dry-run
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { uploadQuickReplicaBuiltinPreview } from "../lib/canvas/canvas-oss";
import type { QrTemplateJson } from "../lib/quick-replica/qr-types";

const ROOT = resolve(__dirname, "..");
const SEED_JSON = resolve(ROOT, "content", "quick-replica", "character-gallery-seed.json");
const OUT_JSON = resolve(ROOT, "content", "quick-replica", "builtin-character-gallery.json");
const URLS_JSON = resolve(ROOT, "content", "quick-replica", "builtin-character-gallery.urls.json");

type SeedRow = {
  id: string;
  title: string;
  kind: string;
  sourceUrl: string;
};

function loadSeed(): SeedRow[] {
  const raw = readFileSync(SEED_JSON, "utf8");
  return JSON.parse(raw) as SeedRow[];
}

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "image/webp";
  const ext = url.toLowerCase().endsWith(".webp")
    ? "webp"
    : url.toLowerCase().endsWith(".png")
      ? "png"
      : "jpg";
  return { buf: Buffer.from(await res.arrayBuffer()), contentType, ext };
}

function buildTemplate(row: SeedRow, thumbnailUrl: string, sortOrder: number): QrTemplateJson {
  const now = "2026-06-20T00:00:00.000Z";
  return {
    schemaVersion: 1,
    id: row.id,
    category: "character",
    kind: "create-character",
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
        role: "IMAGE",
        modelKey: "lib-nano-pro",
        params: {},
      },
    },
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const seed = loadSeed();
  const urlMap: Record<string, string> = {};
  const templates: QrTemplateJson[] = [];
  let ok = 0;

  for (let i = 0; i < seed.length; i += 1) {
    const row = seed[i];
    const sortOrder = 100 + i;

    if (dryRun) {
      console.log(`[dry-run] ${row.id} ← ${row.sourceUrl}`);
      templates.push(buildTemplate(row, row.sourceUrl, sortOrder));
      ok += 1;
      continue;
    }

    try {
      const { buf, contentType, ext } = await fetchImageBuffer(row.sourceUrl);
      const url = await uploadQuickReplicaBuiltinPreview({
        id: row.id,
        buf,
        contentType,
        ext,
      });
      urlMap[row.id] = url;
      templates.push(buildTemplate(row, url, sortOrder));
      ok += 1;
      if (ok % 5 === 0) console.log(`[upload] ${ok}/${seed.length}`);
      console.log(`[ok] ${row.id} → ${url}`);
    } catch (e) {
      console.error(`[fail] ${row.id}`, e);
    }
  }

  if (dryRun) {
    console.log(`[dry-run] would write ${templates.length} templates → ${OUT_JSON}`);
    return;
  }

  if (templates.length === 0) {
    console.error("[sync-quick-replica-character-gallery] no templates generated");
    process.exit(1);
  }

  writeFileSync(OUT_JSON, JSON.stringify(templates, null, 2) + "\n");
  writeFileSync(URLS_JSON, JSON.stringify(urlMap, null, 2) + "\n");
  console.log(
    `[sync-quick-replica-character-gallery] done · seed=${seed.length} saved=${templates.length} → ${OUT_JSON}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
