/* eslint-disable no-console */
/**
 * 批量上传风格库预览图到 OSS，并回写 canvas-web catalog。
 *
 * 准备图片：canvas-web/assets/style-library-source/{presetId}.webp（或 .jpg / .png）
 * 环境：book-mall/.env.local 中 OSS_* / OSS_PUBLIC_URL_BASE
 *
 * 使用：
 *   cd book-mall && pnpm canvas:upload-style-library
 *   pnpm canvas:upload-style-library --dry-run
 *   pnpm canvas:upload-style-library --skip-existing
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { uploadStyleLibraryPreview } from "../lib/canvas/canvas-oss";

const ROOT = resolve(__dirname, "..", "..");
const SOURCE_DIR = resolve(ROOT, "canvas-web", "assets", "style-library-source");
const CATALOG_TS = resolve(
  ROOT,
  "canvas-web",
  "lib",
  "canvas",
  "style-library",
  "catalog.ts",
);
const URLS_JSON = resolve(
  ROOT,
  "canvas-web",
  "lib",
  "canvas",
  "style-library",
  "catalog.urls.json",
);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function loadPresetIds(): string[] {
  const text = readFileSync(CATALOG_TS, "utf8");
  const ids: string[] = [];
  const re = /\{ id: "([^"]+)", category:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    ids.push(m[1]);
  }
  return ids;
}

function findLocalFile(id: string): { path: string; ext: string } | null {
  for (const ext of [".webp", ".jpg", ".jpeg", ".png"]) {
    const p = resolve(SOURCE_DIR, `${id}${ext}`);
    try {
      readFileSync(p);
      return { path: p, ext: ext.replace(/^\./, "") };
    } catch {
      /* try next */
    }
  }
  return null;
}

function patchCatalogTs(urlMap: Record<string, string>): void {
  let text = readFileSync(CATALOG_TS, "utf8");
  for (const [id, url] of Object.entries(urlMap)) {
    const esc = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const escId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(\\{ id: "${escId}"[^}]*imageUrl: )(?:""|"[^"]*")`,
    );
    if (!re.test(text)) {
      console.warn(`[upload-style-library] catalog id not found for patch: ${id}`);
      continue;
    }
    text = text.replace(re, `$1"${esc}"`);
  }
  writeFileSync(CATALOG_TS, text);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipExisting = process.argv.includes("--skip-existing");

  let filesInDir: string[] = [];
  try {
    filesInDir = readdirSync(SOURCE_DIR);
  } catch {
    console.error(`[upload-style-library] missing source dir: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const ids = loadPresetIds();
  const urlMap: Record<string, string> = {};
  let uploaded = 0;
  let missing = 0;
  let skipped = 0;

  for (const id of ids) {
    const local = findLocalFile(id);
    if (!local) {
      missing += 1;
      continue;
    }
    const buf = readFileSync(local.path);
    const ext = local.ext;
    const mime = MIME[extname(local.path).toLowerCase()] ?? "image/webp";

    if (dryRun) {
      console.log(`[dry-run] ${id} → canvas/style-library/${id}.${ext} (${buf.length} bytes)`);
      uploaded += 1;
      continue;
    }

    try {
      const url = await uploadStyleLibraryPreview({
        id,
        buf,
        contentType: mime,
        ext,
      });
      urlMap[id] = url;
      uploaded += 1;
      console.log(`[ok] ${id} → ${url}`);
    } catch (e) {
      if (skipExisting && e instanceof Error && /409|exist/i.test(e.message)) {
        skipped += 1;
        console.log(`[skip] ${id}`);
        continue;
      }
      console.error(`[fail] ${id}`, e);
    }
  }

  if (!dryRun && Object.keys(urlMap).length > 0) {
    writeFileSync(URLS_JSON, JSON.stringify(urlMap, null, 2) + "\n");
    patchCatalogTs(urlMap);
    console.log(`[upload-style-library] wrote ${URLS_JSON} and patched catalog.ts`);
  }

  console.log(
    `[upload-style-library] done · catalog=${ids.length} uploaded=${uploaded} missing_local=${missing} skipped=${skipped} dir_files=${filesInDir.length}`,
  );
  if (missing > 0) {
    console.log(
      `[upload-style-library] place images in ${SOURCE_DIR} as {id}.webp`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
