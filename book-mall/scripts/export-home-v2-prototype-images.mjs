#!/usr/bin/env node
/**
 * 从 Downloads/home/index.html 导出 base64 图到 public/site-home-v2/
 * 用法: node scripts/export-home-v2-prototype-images.mjs [/path/to/index.html]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath =
  process.argv[2] || join(process.env.HOME || "", "Downloads/home/index.html");
const outDir = join(root, "public/site-home-v2");

const html = await (await import("node:fs/promises")).readFile(htmlPath, "utf8");

function saveDataUrl(dataUrl, name) {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
  if (!m) return null;
  let ext = m[1] === "jpeg" ? "jpg" : m[1];
  const buf = Buffer.from(m[2], "base64");
  const path = join(outDir, `${name}.${ext}`);
  return writeFile(path, buf).then(() => `/site-home-v2/${name}.${ext}`);
}

await mkdir(outDir, { recursive: true });

const hero = html.match(
  /class="hero-visual">\s*<img src="(data:image\/[^"]+)" alt="([^"]*)"/,
);
if (hero) {
  const p = await saveDataUrl(hero[1], "hero");
  console.log("hero", p, hero[2]);
}

const names = ["scene-office", "scene-content", "scene-image", "scene-video", "scene-music"];
let i = 0;
for (const m of html.matchAll(
  /<img class="od-media" src="(data:image\/[^"]+)" alt="([^"]*)"/g,
)) {
  const name = names[i] ?? `scene-${i}`;
  const p = await saveDataUrl(m[1], name);
  console.log(name, p, m[2]);
  i += 1;
}

console.log("Done →", outDir);
