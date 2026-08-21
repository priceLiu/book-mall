#!/usr/bin/env node
/**
 * Regenerate architecture diagram assets from docs/全站架构图.mmd
 * Uses Kroki (https://kroki.io) — no local Chromium required.
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mmdPath = join(root, "docs/全站架构图.mmd");
const pngMermaid = join(root, "docs/全站架构图-mermaid.png");
const pngMain = join(root, "docs/全站架构图.png");
const pngAscii = join(root, "docs/site-architecture-diagram.png");
const svgPath = join(root, "docs/全站架构图.svg");
const svgAscii = join(root, "docs/site-architecture-diagram.svg");

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
