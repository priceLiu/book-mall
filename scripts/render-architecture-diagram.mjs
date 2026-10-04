#!/usr/bin/env node
/**
 * Regenerate architecture diagram assets from docs/全站架构图.mmd (default)
 * or docs/全站架构图-中文.mmd (--zh).
 * Uses Kroki (https://kroki.io) — no local Chromium required.
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const zh = process.argv.includes("--zh");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const preset = zh
  ? {
      mmdPath: join(root, "docs/全站架构图-中文.mmd"),
      pngMermaid: join(root, "docs/全站架构图-中文-mermaid.png"),
      pngMain: join(root, "docs/全站架构图-中文.png"),
      pngAscii: join(root, "docs/site-architecture-diagram-zh.png"),
      svgPath: join(root, "docs/全站架构图-中文.svg"),
      svgAscii: join(root, "docs/site-architecture-diagram-zh.svg"),
    }
  : {
      mmdPath: join(root, "docs/全站架构图.mmd"),
      pngMermaid: join(root, "docs/全站架构图-mermaid.png"),
      pngMain: join(root, "docs/全站架构图.png"),
      pngAscii: join(root, "docs/site-architecture-diagram.png"),
      svgPath: join(root, "docs/全站架构图.svg"),
      svgAscii: join(root, "docs/site-architecture-diagram.svg"),
    };

const { mmdPath, pngMermaid, pngMain, pngAscii, svgPath, svgAscii } = preset;
const source = readFileSync(mmdPath, "utf8");

async function kroki(format, outPath) {
  const res = await fetch(`https://kroki.io/mermaid/${format}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kroki ${format} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
}

await kroki("png", pngMermaid);
copyFileSync(pngMermaid, pngMain);
copyFileSync(pngMermaid, pngAscii);
console.log(`Synced ${pngMain} + ${pngAscii}`);
await kroki("svg", svgPath);
copyFileSync(svgPath, svgAscii);
console.log(`Synced ${svgAscii}`);
