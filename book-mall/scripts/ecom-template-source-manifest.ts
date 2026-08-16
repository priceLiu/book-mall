/* eslint-disable no-console */
/**
 * 扫描 book-mall/tmp 下品类 HTML，输出「源 URL stem ↔ catalog id」对账表。
 *
 *   cd book-mall && pnpm exec tsx scripts/ecom-template-source-manifest.ts
 *   cd book-mall && pnpm exec tsx scripts/ecom-template-source-manifest.ts -- --out tmp/ecom-source-manifest.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  catalogEntryStemFromId,
  fileStemFromUrl,
} from "../lib/ecom/ecom-template-source-stem";
import { listTemplateGalleryEntriesFromDb } from "../lib/ecom/ecom-template-gallery-service";
import {
  inferTemplateCategoryFromFilename,
  parseTemplateGalleryHtml,
  YIBIAIGC_DEMO_CARD_CONFIG,
} from "../../e-commerce-toolkit/lib/ecom-template-gallery/html-parse";
import {
  isEcomTemplateCategory,
  type EcomTemplateCategory,
} from "../../e-commerce-toolkit/lib/ecom-template-gallery/types";

const BOOK_MALL = resolve(__dirname, "..");
const HTML_DIRS = [
  resolve(BOOK_MALL, "tmp", "pic"),
  resolve(BOOK_MALL, "tmp", "视频"),
];

type ManifestRow = {
  htmlFile: string;
  category: EcomTemplateCategory;
  sourceUrl: string;
  stem: string;
  status: "imported" | "missing";
  catalogId: string | null;
  title: string | null;
};

function collectHtmlFiles(): string[] {
  const files: string[] = [];
  for (const dir of HTML_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (/\.html?$/i.test(name)) files.push(resolve(dir, name));
    }
  }
  return files.sort();
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1]?.trim() ?? null;
}

async function main() {
  const outPath =
    argValue("--out") ?? resolve(BOOK_MALL, "tmp", "ecom-source-manifest.json");

  const dbEntries = await listTemplateGalleryEntriesFromDb();
  const stemByCategory = new Map<EcomTemplateCategory, Map<string, string>>();
  for (const entry of dbEntries) {
    if (!isEcomTemplateCategory(entry.category)) continue;
    const stem = catalogEntryStemFromId(entry.id);
    if (!stem) continue;
    let map = stemByCategory.get(entry.category);
    if (!map) {
      map = new Map();
      stemByCategory.set(entry.category, map);
    }
    map.set(stem, entry.id);
  }

  const rows: ManifestRow[] = [];
  const seen = new Set<string>();

  for (const filePath of collectHtmlFiles()) {
    const fileName = basename(filePath);
    const inferred = inferTemplateCategoryFromFilename(fileName);
    if (!inferred) {
      console.warn(`[skip] 无法推断品类: ${fileName}`);
      continue;
    }
    const html = readFileSync(filePath, "utf8");
    const parsed = parseTemplateGalleryHtml(
      html,
      YIBIAIGC_DEMO_CARD_CONFIG,
      inferred,
      [],
      "all",
    );
    const index = stemByCategory.get(inferred) ?? new Map<string, string>();

    for (const row of parsed) {
      const stem = fileStemFromUrl(row.sourceUrl);
      const dedupeKey = `${inferred}:${stem}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const catalogId = index.get(stem) ?? null;
      rows.push({
        htmlFile: fileName,
        category: inferred,
        sourceUrl: row.sourceUrl,
        stem,
        status: catalogId ? "imported" : "missing",
        catalogId,
        title: row.title,
      });
    }
  }

  rows.sort((a, b) =>
    `${a.category}:${a.stem}`.localeCompare(`${b.category}:${b.stem}`),
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    imported: rows.filter((r) => r.status === "imported").length,
    missing: rows.filter((r) => r.status === "missing").length,
    rows,
  };

  writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(
    `[ecom-template-source-manifest] total=${summary.total} imported=${summary.imported} missing=${summary.missing} → ${outPath}`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
