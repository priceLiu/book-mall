/* eslint-disable no-console */
/**
 * 从 canvas-web/docs/style.html 的 picsum 链接下载预览图，按 catalog 的 id 命名保存。
 * 使用：cd book-mall && pnpm canvas:fetch-style-library-from-html
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

const ROOT = resolve(__dirname, "..", "..");
const STYLE_HTML = resolve(ROOT, "canvas-web", "docs", "style.html");
const SOURCE_DIR = resolve(ROOT, "canvas-web", "assets", "style-library-source");
const CATALOG_TS = resolve(
  ROOT,
  "canvas-web",
  "lib",
  "canvas",
  "style-library",
  "catalog.ts",
);

type HtmlRow = { category: string; name: string; image: string };
type CatalogRow = { id: string; category: string; name: string };

function loadHtmlRows(): HtmlRow[] {
  const text = readFileSync(STYLE_HTML, "utf8");
  const rows: HtmlRow[] = [];
  const re =
    /\{category:"([^"]+)",name:"([^"]+)",image:"([^"]+)",prompt:"[^"]*"\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    rows.push({ category: m[1], name: m[2], image: m[3] });
  }
  return rows;
}

function loadCatalogRows(): CatalogRow[] {
  const text = readFileSync(CATALOG_TS, "utf8");
  const rows: CatalogRow[] = [];
  const re = /\{ id: "([^"]+)", category: "([^"]+)", name: "([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    rows.push({ id: m[1], category: m[2], name: m[3] });
  }
  return rows;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function downloadWebp(primaryUrl: string, fallbackSeed: string): Promise<Buffer> {
  const urls = [
    primaryUrl,
    `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/550`,
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const buf = await fetchImageBuffer(url);
      return sharp(buf)
        .resize(400, 550, { fit: "cover", position: "centre" })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function main() {
  const htmlRows = loadHtmlRows();
  const catalogRows = loadCatalogRows();
  if (!htmlRows.length) {
    console.error("[fetch-style-library] no rows in style.html");
    process.exit(1);
  }

  const htmlByKey = new Map<string, HtmlRow>();
  for (const row of htmlRows) {
    htmlByKey.set(`${row.category}\0${row.name}`, row);
  }

  mkdirSync(SOURCE_DIR, { recursive: true });
  let ok = 0;
  let miss = 0;

  for (const cat of catalogRows) {
    const html = htmlByKey.get(`${cat.category}\0${cat.name}`);
    if (!html) {
      console.warn(`[fetch-style-library] no html match: ${cat.category} / ${cat.name}`);
      miss += 1;
      continue;
    }
    try {
      const webp = await downloadWebp(html.image, cat.id);
      writeFileSync(resolve(SOURCE_DIR, `${cat.id}.webp`), webp);
      ok += 1;
      if (ok % 15 === 0) console.log(`[fetch] ${ok}/${catalogRows.length}`);
    } catch (e) {
      console.error(`[fetch-style-library] fail ${cat.id}`, e);
      miss += 1;
    }
  }

  console.log(
    `[fetch-style-library] done · catalog=${catalogRows.length} saved=${ok} miss=${miss} → ${SOURCE_DIR}`,
  );
  if (miss > 0) {
    console.warn(`[fetch-style-library] ${miss} failed — run canvas:generate-style-library-placeholders for gaps`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
