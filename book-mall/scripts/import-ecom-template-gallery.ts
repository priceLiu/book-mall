/* eslint-disable no-console */
/**
 * 从 book-mall/tmp 下的品类 HTML 解析模板案例，上传 OSS（原图作预览 + webp 缩略图）并入库。
 *
 * 解析与上传全部复用工具箱页面导入的同一套实现：
 *   解析 / id 生成 → e-commerce-toolkit/lib/ecom-template-gallery/html-parse.ts
 *   单条上传入库   → lib/ecom/ecom-template-gallery-service.ts#importTemplateGalleryItem
 * 故 CLI 与页面导入产出的 id、原图/缩略图策略完全一致，两条线不会互相产生重复条目。
 * 此处曾自带一份简化实现，代价是只认两个分类、不支持视频、去重查的是打包快照而非库。
 *
 * 默认每条都过 importTemplateGalleryItem，它自带 OSS 存在性探测，已传过的不会重传，
 * 且能补齐「有原图缺缩略图」的半成品条目。
 *
 *   cd book-mall
 *   pnpm ecom:import-template-gallery -- --category shoes
 *   pnpm ecom:import-template-gallery -- --file "tmp/pic/帽子.html"
 *   pnpm ecom:import-template-gallery -- --category kids --media video
 *   pnpm ecom:import-template-gallery -- --category shoes --dry-run
 *   pnpm ecom:import-template-gallery -- --category shoes --skip-known  # 跳过库中已登记 id，省掉 OSS 探测
 *   pnpm ecom:import-template-gallery -- --category shoes --thumb-only  # 只补缩略图
 *   pnpm ecom:import-template-gallery -- --category shoes --sync-oss    # 只把 OSS 已有对象补登记进库
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

import {
  ossObjectExists,
  ossPublicUrlForKeyFromEnv,
  uploadEcomTemplateGalleryThumb,
} from "../lib/canvas/canvas-oss";
import {
  buildEcomTemplateGalleryOssKey,
  buildEcomTemplateGalleryThumbOssKey,
} from "../lib/canvas/canvas-constants";
import { buildEcomGalleryThumbWebp } from "../lib/ecom/ecom-gallery-thumb";
import {
  importTemplateGalleryItem,
  listTemplateGalleryEntryIdsFromDb,
  readTemplateGalleryCatalogLive,
  upsertTemplateGalleryEntry,
  type EcomTemplateGalleryEntry,
} from "../lib/ecom/ecom-template-gallery-service";
import {
  YIBIAIGC_DEMO_CARD_CONFIG,
  parseTemplateGalleryHtml,
  type ParsedImportRow,
} from "../../e-commerce-toolkit/lib/ecom-template-gallery/html-parse";
import {
  ECOM_TEMPLATE_CATEGORY_META,
  inferTemplateCategoryFromFilename,
  isEcomTemplateCategory,
  templateCategoryLabel,
  type EcomTemplateCategory,
  type EcomTemplateEntryRef,
  type EcomTemplateMediaKind,
} from "../../e-commerce-toolkit/lib/ecom-template-gallery/types";

const ROOT = resolve(__dirname, "..", "..");
const BOOK_MALL = resolve(ROOT, "book-mall");

/** 靠前者优先：同一分类在两处都有 HTML 时取 tmp/pic 下的那份 */
const HTML_DIRS = [resolve(BOOK_MALL, "tmp", "pic"), resolve(BOOK_MALL, "tmp")];

const IMPORT_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.ECOM_IMPORT_CONCURRENCY ?? "10", 10) || 10,
);

const FETCH_RETRIES = 3;

type MediaFilter = "all" | EcomTemplateMediaKind;

function fail(message: string): never {
  console.error(`[import-template-gallery] ${message}`);
  process.exit(1);
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const raw = process.argv[idx + 1]?.trim();
  return raw && !raw.startsWith("--") ? raw : null;
}

function knownCategoriesHint(): string {
  return ECOM_TEMPLATE_CATEGORY_META.map((c) => `${c.id}(${c.label})`).join(" ");
}

function requireCategory(raw: string, from: string): EcomTemplateCategory {
  if (isEcomTemplateCategory(raw)) return raw;
  return fail(
    `未登记的分类 ${raw}（来自 ${from}）\n已登记：${knownCategoriesHint()}`,
  );
}

function listCandidateHtml(): string[] {
  const out: string[] = [];
  for (const dir of HTML_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.toLowerCase().endsWith(".html")) out.push(resolve(dir, name));
    }
  }
  return out;
}

type ImportSource = { category: EcomTemplateCategory; htmlPath: string };

function resolveSource(): ImportSource {
  const fileArg = argValue("--file");
  const categoryArg = argValue("--category");

  if (fileArg) {
    const htmlPath = isAbsolute(fileArg) ? fileArg : resolve(BOOK_MALL, fileArg);
    if (!existsSync(htmlPath)) return fail(`--file 不存在：${htmlPath}`);
    if (categoryArg) {
      return { category: requireCategory(categoryArg, "--category"), htmlPath };
    }
    const inferred = inferTemplateCategoryFromFilename(basename(htmlPath));
    if (!inferred) {
      return fail(
        `无法从文件名推断分类：${basename(htmlPath)}\n请补 --category <id>；已登记：${knownCategoriesHint()}`,
      );
    }
    return { category: inferred, htmlPath };
  }

  if (!categoryArg) {
    return fail(
      `请指定 --category <id> 或 --file <path>\n已登记分类：${knownCategoriesHint()}`,
    );
  }

  const category = requireCategory(categoryArg, "--category");
  const matches = listCandidateHtml().filter(
    (p) => inferTemplateCategoryFromFilename(basename(p)) === category,
  );
  if (matches.length === 0) {
    return fail(
      `未找到 ${category}(${templateCategoryLabel(category)}) 对应的 HTML\n已查找：${HTML_DIRS.join(" , ")}\n可用 --file <path> 显式指定`,
    );
  }
  if (matches.length > 1) {
    console.warn(
      `[warn] ${category} 命中多个 HTML，取第一个：\n  ${matches.join("\n  ")}`,
    );
  }
  return { category, htmlPath: matches[0]! };
}

function parseMediaFilter(): MediaFilter {
  const raw = argValue("--media");
  if (!raw) return "all";
  if (raw === "all" || raw === "image" || raw === "video") return raw;
  return fail(`--media 只能是 all / image / video，收到 ${raw}`);
}

/**
 * 去重与 id 复用以库为准。此处刻意不回退打包快照：
 * 误判「未导入」会整批重传，比直接报错危险得多。
 */
async function loadExistingRefs(
  category: EcomTemplateCategory,
): Promise<EcomTemplateEntryRef[]> {
  const ids = await listTemplateGalleryEntryIdsFromDb(category);
  return ids.map((id) => ({ id, category }));
}

type Counters = { uploaded: number; skipped: number; failed: number };

function progressPath(category: string): string {
  return resolve(BOOK_MALL, "tmp", `ecom-import-${category}-progress.json`);
}

function syncImportProgress(args: {
  category: EcomTemplateCategory;
  total: number;
  counters: Counters;
  lastId?: string;
  forceLog?: boolean;
}): void {
  const { uploaded, skipped, failed } = args.counters;
  const done = uploaded + skipped + failed;
  const pct = args.total > 0 ? Math.round((done / args.total) * 100) : 0;
  writeFileSync(
    progressPath(args.category),
    JSON.stringify(
      {
        category: args.category,
        done,
        total: args.total,
        percent: pct,
        uploaded,
        skipped,
        failed,
        lastId: args.lastId ?? null,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  if (args.forceLog || done % 5 === 0 || done === args.total) {
    console.log(
      `[progress] ${args.category} ${done}/${args.total} (${pct}%) · uploaded=${uploaded} skipped=${skipped} failed=${failed}${args.lastId ? ` · last=${args.lastId}` : ""}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBuffer(url: string, attempt = 1): Promise<Buffer> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (attempt >= FETCH_RETRIES) throw e;
    console.warn(`[warn] fetch retry ${attempt}/${FETCH_RETRIES} ${url}`);
    await sleep(800 * attempt);
    return fetchBuffer(url, attempt + 1);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

/** OSS 已有对象但库里没登记时，据 OSS 反查补登记 */
async function resolveExistingOssEntry(
  row: ParsedImportRow,
  category: EcomTemplateCategory,
): Promise<EcomTemplateGalleryEntry | null> {
  try {
    const previewKey = buildEcomTemplateGalleryOssKey(
      category,
      row.suggestedId,
      row.ext,
    );
    const thumbKey = buildEcomTemplateGalleryThumbOssKey(
      category,
      row.suggestedId,
    );
    const [previewExists, thumbExists] = await Promise.all([
      ossObjectExists(previewKey),
      ossObjectExists(thumbKey),
    ]);
    if (!previewExists || !thumbExists) return null;
    return {
      id: row.suggestedId,
      category,
      mediaKind: row.mediaKind,
      title: row.title,
      hot: row.hot,
      ossUrl: ossPublicUrlForKeyFromEnv(previewKey),
      thumbUrl: ossPublicUrlForKeyFromEnv(thumbKey),
      posterUrl: row.posterUrl ?? null,
    };
  } catch (e) {
    console.warn(`[warn] oss head ${row.suggestedId}`, e);
    return null;
  }
}

async function syncCatalogFromOss(
  rows: ParsedImportRow[],
  category: EcomTemplateCategory,
  dryRun: boolean,
): Promise<void> {
  console.log(
    `[import-template-gallery] sync-oss · scanning ${rows.length} ${category} rows`,
  );
  let found = 0;
  await mapPool(rows, IMPORT_CONCURRENCY, async (row) => {
    const entry = await resolveExistingOssEntry(row, category);
    if (!entry) return;
    found += 1;
    if (dryRun) {
      console.log(`[dry-run] sync ${entry.id} ← ${entry.ossUrl}`);
      return;
    }
    await upsertTemplateGalleryEntry(entry);
    console.log(`[ok] sync ${entry.id}`);
  });
  console.log(
    `[import-template-gallery] sync-oss done · found=${found} / ${rows.length}`,
  );
}

async function backfillThumbs(
  entries: EcomTemplateGalleryEntry[],
  dryRun: boolean,
): Promise<Counters> {
  const counters: Counters = { uploaded: 0, skipped: 0, failed: 0 };

  await mapPool(entries, IMPORT_CONCURRENCY, async (entry) => {
    if (entry.thumbUrl?.trim()) {
      counters.skipped += 1;
      return;
    }
    if (!entry.ossUrl?.trim()) {
      counters.failed += 1;
      console.error(`[fail] ${entry.id} missing ossUrl`);
      return;
    }
    if (dryRun) {
      counters.uploaded += 1;
      console.log(`[dry-run] thumb ${entry.id} ← ${entry.ossUrl}`);
      return;
    }

    try {
      const buf = await fetchBuffer(entry.ossUrl);
      const thumbBuf = await buildEcomGalleryThumbWebp(buf);
      const thumbUrl = await uploadEcomTemplateGalleryThumb({
        category: entry.category,
        id: entry.id,
        buf: thumbBuf,
      });
      await upsertTemplateGalleryEntry({ ...entry, thumbUrl });
      counters.uploaded += 1;
      console.log(`[ok] thumb ${entry.id} → ${thumbUrl}`);
    } catch (e) {
      counters.failed += 1;
      console.error(`[fail] thumb ${entry.id}`, e);
    }
  });

  return counters;
}

async function runThumbOnly(
  category: EcomTemplateCategory,
  dryRun: boolean,
): Promise<void> {
  const catalog = await readTemplateGalleryCatalogLive(category);
  const targets = catalog.templates.filter(
    (t) => t.category === category && t.ossUrl?.trim(),
  );
  console.log(
    `[import-template-gallery] thumb-only · ${targets.length} ${category} rows`,
  );
  const { uploaded, skipped, failed } = await backfillThumbs(targets, dryRun);
  console.log(
    `[import-template-gallery] thumb-only done · uploaded=${uploaded} skipped=${skipped} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

async function runImport(args: {
  category: EcomTemplateCategory;
  rows: ParsedImportRow[];
  dryRun: boolean;
  skipKnown: boolean;
}): Promise<void> {
  const { category, rows, dryRun, skipKnown } = args;
  const counters: Counters = { uploaded: 0, skipped: 0, failed: 0 };

  syncImportProgress({ category, total: rows.length, counters, forceLog: true });

  await mapPool(rows, IMPORT_CONCURRENCY, async (row) => {
    const bump = () =>
      syncImportProgress({
        category,
        total: rows.length,
        counters,
        lastId: row.suggestedId,
      });

    if (skipKnown && row.alreadyImported) {
      counters.skipped += 1;
      bump();
      return;
    }

    if (dryRun) {
      counters.uploaded += 1;
      console.log(
        `[dry-run] ${row.suggestedId} (${row.mediaKind}) → ${buildEcomTemplateGalleryOssKey(category, row.suggestedId, row.ext)} + thumb`,
      );
      bump();
      return;
    }

    const result = await importTemplateGalleryItem({
      category,
      mediaKind: row.mediaKind,
      id: row.suggestedId,
      sourceUrl: row.sourceUrl,
      title: row.title,
      hot: row.hot,
      ext: row.ext,
      posterUrl: row.posterUrl ?? null,
      thumbSourceUrl: row.thumbSourceUrl ?? null,
    });

    if (result.status === "failed") {
      counters.failed += 1;
      console.error(`[fail] ${row.suggestedId} · ${result.error}`);
    } else if (result.status === "skipped") {
      counters.skipped += 1;
    } else {
      counters.uploaded += 1;
      console.log(`[ok] ${row.suggestedId} → ${result.entry.ossUrl}`);
    }
    bump();
  });

  syncImportProgress({ category, total: rows.length, counters, forceLog: true });
  console.log(
    `[import-template-gallery] done · ${category} total=${rows.length} uploaded=${counters.uploaded} skipped=${counters.skipped} failed=${counters.failed}`,
  );
  if (counters.failed > 0) process.exitCode = 1;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const thumbOnly = process.argv.includes("--thumb-only");
  const syncOss = process.argv.includes("--sync-oss");
  const skipKnown = process.argv.includes("--skip-known");
  const mediaFilter = parseMediaFilter();

  if (thumbOnly) {
    const categoryArg = argValue("--category");
    if (!categoryArg) {
      return fail(
        `--thumb-only 需要 --category <id>\n已登记：${knownCategoriesHint()}`,
      );
    }
    await runThumbOnly(requireCategory(categoryArg, "--category"), dryRun);
    return;
  }

  const { category, htmlPath } = resolveSource();
  const existingRefs = await loadExistingRefs(category);
  const rows = parseTemplateGalleryHtml(
    readFileSync(htmlPath, "utf8"),
    YIBIAIGC_DEMO_CARD_CONFIG,
    category,
    existingRefs,
    mediaFilter,
  );

  console.log(
    `[import-template-gallery] ${category}(${templateCategoryLabel(category)}) · media=${mediaFilter} · 解析 ${rows.length} 条 · 库中已有 ${existingRefs.length} 条\n  源文件 ${htmlPath}`,
  );

  if (syncOss) {
    await syncCatalogFromOss(rows, category, dryRun);
    return;
  }

  await runImport({ category, rows, dryRun, skipKnown });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
