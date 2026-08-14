/* eslint-disable no-console */
/**
 * 从 book-mall/tmp/model.html 解析模特图，下载原图上传 OSS，生成 e-commerce-toolkit catalog。
 *
 *   cd book-mall && pnpm ecom:import-model-library
 *   pnpm ecom:import-model-library --dry-run
 *   pnpm ecom:import-model-library --skip-existing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { uploadEcomModelLibraryPreview } from "../lib/canvas/canvas-oss";

const ROOT = resolve(__dirname, "..", "..");
const MODEL_HTML = resolve(ROOT, "book-mall", "tmp", "model.html");
const CATALOG_JSON = resolve(
  ROOT,
  "e-commerce-toolkit",
  "lib",
  "ecom-model-library",
  "catalog.json",
);

export type EcomModelGender = "female" | "male" | "plus_female";
export type EcomModelAge = "adult" | "child";

export type EcomModelLibraryEntry = {
  id: string;
  name: string;
  gender: EcomModelGender;
  age: EcomModelAge;
  ossUrl: string;
};

type ParsedRow = {
  name: string;
  gender: EcomModelGender;
  age: EcomModelAge;
  id: string;
  sourceUrl: string;
  ext: string;
};

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function stripOssProcess(url: string): string {
  return url.split("?")[0] ?? url;
}

function extFromUrl(url: string): string {
  const path = stripOssProcess(url);
  const ext = extname(path).replace(/^\./, "").toLowerCase();
  return ext || "jpg";
}

function fileStemFromUrl(url: string): string {
  const path = stripOssProcess(url);
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.[^.]+$/, "").slice(0, 8);
}

function parseAlt(alt: string): {
  name: string;
  gender: EcomModelGender;
  age: EcomModelAge;
  idBase: string;
} {
  const num = alt.match(/\d+/)?.[0] ?? "0";
  if (alt.startsWith("大码女模特")) {
    return { name: alt, gender: "plus_female", age: "adult", idBase: `plus_female-${num}` };
  }
  if (alt.startsWith("女模特")) {
    return { name: alt, gender: "female", age: "adult", idBase: `female-${num}` };
  }
  if (alt.startsWith("男模特")) {
    return { name: alt, gender: "male", age: "adult", idBase: `male-${num}` };
  }
  if (alt.startsWith("女童")) {
    return { name: alt, gender: "female", age: "child", idBase: `girl-${num}` };
  }
  if (alt.startsWith("男童")) {
    return { name: alt, gender: "male", age: "child", idBase: `boy-${num}` };
  }
  throw new Error(`无法解析 alt: ${alt}`);
}

function loadParsedRows(): ParsedRow[] {
  const html = readFileSync(MODEL_HTML, "utf8");
  const re = /src="(https:\/\/yb-ai[^"]+)"[^>]*alt="([^"]+)"/g;
  const raw: Array<Omit<ParsedRow, "id"> & { idBase: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const sourceUrl = stripOssProcess(m[1]);
    const meta = parseAlt(m[2].trim());
    raw.push({
      name: meta.name,
      gender: meta.gender,
      age: meta.age,
      idBase: meta.idBase,
      sourceUrl,
      ext: extFromUrl(sourceUrl),
    });
  }

  const idBaseCount = new Map<string, number>();
  return raw.map((row) => {
    const seen = (idBaseCount.get(row.idBase) ?? 0) + 1;
    idBaseCount.set(row.idBase, seen);
    const id =
      seen > 1 ? `${row.idBase}-${fileStemFromUrl(row.sourceUrl)}` : row.idBase;
    const { idBase: _drop, ...rest } = row;
    return { ...rest, id };
  });
}

function loadExistingCatalog(): Map<string, EcomModelLibraryEntry> {
  try {
    const data = JSON.parse(readFileSync(CATALOG_JSON, "utf8")) as {
      models?: EcomModelLibraryEntry[];
    };
    const map = new Map<string, EcomModelLibraryEntry>();
    for (const row of data.models ?? []) {
      if (row.id && row.ossUrl) map.set(row.id, row);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipExisting = process.argv.includes("--skip-existing");

  const rows = loadParsedRows();
  console.log(`[import-model-library] parsed ${rows.length} rows from model.html`);

  const existing = skipExisting ? loadExistingCatalog() : new Map<string, EcomModelLibraryEntry>();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  const catalog = await mapPool(rows, 5, async (row) => {
    const prev = existing.get(row.id);
    if (prev?.ossUrl) {
      skipped += 1;
      return prev;
    }

    if (dryRun) {
      uploaded += 1;
      console.log(
        `[dry-run] ${row.id} ${row.name} (${row.gender}/${row.age}) → ecom/model-library/${row.id}.${row.ext}`,
      );
      return {
        id: row.id,
        name: row.name,
        gender: row.gender,
        age: row.age,
        ossUrl: `https://example.com/ecom/model-library/${row.id}.${row.ext}`,
      };
    }

    try {
      const buf = await fetchBuffer(row.sourceUrl);
      const mime = MIME[`.${row.ext}`] ?? "image/jpeg";
      const ossUrl = await uploadEcomModelLibraryPreview({
        id: row.id,
        buf,
        contentType: mime,
        ext: row.ext,
      });
      uploaded += 1;
      console.log(`[ok] ${row.id} → ${ossUrl}`);
      return {
        id: row.id,
        name: row.name,
        gender: row.gender,
        age: row.age,
        ossUrl,
      };
    } catch (e) {
      failed += 1;
      console.error(`[fail] ${row.id} (${row.name})`, e);
      return null;
    }
  });

  const models = catalog.filter((e): e is EcomModelLibraryEntry => e !== null);
  models.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  if (!dryRun) {
    writeFileSync(CATALOG_JSON, JSON.stringify({ models }, null, 2) + "\n");
    console.log(`[import-model-library] wrote ${CATALOG_JSON}`);
  }

  console.log(
    `[import-model-library] done · parsed=${rows.length} catalog=${models.length} uploaded=${uploaded} skipped=${skipped} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
