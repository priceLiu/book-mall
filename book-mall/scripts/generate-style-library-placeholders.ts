/* eslint-disable no-console */
/**
 * 为风格库生成本地占位预览图（400×550 webp），便于 upload-style-library 上传 OSS。
 * 使用：cd book-mall && pnpm exec tsx scripts/generate-style-library-placeholders.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

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

type PresetRow = { id: string; name: string; category: string };

function loadPresets(): PresetRow[] {
  const text = readFileSync(CATALOG_TS, "utf8");
  const rows: PresetRow[] = [];
  const re =
    /\{ id: "([^"]+)", category: "([^"]+)", name: "([^"]+)", prompt: "[^"]*", imageUrl: "" \}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    rows.push({ id: m[1], name: m[3], category: m[2] });
  }
  return rows;
}

function colorFromId(id: string): { r: number; g: number; b: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  const s = 0.35;
  const l = 0.28;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderPlaceholder(row: PresetRow): Promise<Buffer> {
  const { r, g, b } = colorFromId(row.id);
  const w = 400;
  const h = 550;
  const title = escapeXml(row.name.slice(0, 12));
  const cat = escapeXml(row.category.slice(0, 10));
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="rgb(${r},${g},${b})"/>
  <rect x="0" y="${h - 120}" width="100%" height="120" fill="rgba(0,0,0,0.55)"/>
  <text x="20" y="${h - 72}" fill="#fff" font-size="22" font-family="sans-serif" font-weight="600">${title}</text>
  <text x="20" y="${h - 40}" fill="rgba(255,255,255,0.75)" font-size="14" font-family="sans-serif">${cat}</text>
  <text x="20" y="36" fill="rgba(255,255,255,0.35)" font-size="11" font-family="monospace">style-library</text>
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

async function main() {
  const presets = loadPresets();
  if (!presets.length) {
    console.error("[generate-style-library-placeholders] no presets in catalog.ts");
    process.exit(1);
  }
  mkdirSync(SOURCE_DIR, { recursive: true });
  let n = 0;
  let skipped = 0;
  for (const row of presets) {
    const out = resolve(SOURCE_DIR, `${row.id}.webp`);
    if (existsSync(out)) {
      skipped += 1;
      continue;
    }
    const buf = await renderPlaceholder(row);
    writeFileSync(out, buf);
    n += 1;
    if (n % 20 === 0) console.log(`[generate] ${n}/${presets.length}`);
  }
  console.log(
    `[generate-style-library-placeholders] wrote ${n} skipped_existing=${skipped} → ${SOURCE_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
