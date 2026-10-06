#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mdPath = path.join(repoRoot, "docs/镜头描述提示词.md");
const outPath = path.join(
  repoRoot,
  "canvas-web/lib/canvas/camera-shot-library/catalog.ts",
);

const md = fs.readFileSync(mdPath, "utf8");
const blocks = md.split(/\n(?=\d+\n)/).filter((b) => /^\d+\n/.test(b));
const presets = [];
for (const b of blocks) {
  const idx = parseInt(b.split("\n")[0], 10);
  const name = b.match(/🔖 镜头名称：(.+)/)?.[1]?.trim();
  const meaningZh = b.match(/📖 中文释义：(.+)/)?.[1]?.trim();
  const sceneExampleZh = b.match(/📝 参考画面示例：(.+)/)?.[1]?.trim();
  const cameraPromptEn = b.match(/🎬 英文运镜提示词：(.+)/)?.[1]?.trim();
  if (!name) continue;
  const slug =
    name
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `shot-${idx}`;
  presets.push({
    id: `cam:${String(idx).padStart(2, "0")}-${slug}`,
    index: idx,
    name,
    meaningZh: meaningZh ?? "",
    sceneExampleZh: sceneExampleZh ?? "",
    cameraPromptEn: cameraPromptEn ?? "",
  });
}

const out = `/**
 * 平台镜头描述库（由 docs/镜头描述提示词.md 生成，勿手改）
 * 重新生成：node canvas-web/scripts/generate-camera-shot-catalog.mjs
 */
export type CameraShotPreset = {
  id: string;
  index: number;
  name: string;
  meaningZh: string;
  sceneExampleZh: string;
  cameraPromptEn: string;
};

export const CAMERA_SHOT_PRESETS: CameraShotPreset[] = ${JSON.stringify(presets, null, 2)} as CameraShotPreset[];

export const CAMERA_SHOT_NEGATIVE_PROMPT =
  "blurry, deformed, bad anatomy, ugly, disfigured, extra limbs, watermark, text, logo, oversaturated";

export function findCameraShotPreset(id: string): CameraShotPreset | undefined {
  return CAMERA_SHOT_PRESETS.find((p) => p.id === id);
}

export function buildCameraShotRunPrompt(
  preset: CameraShotPreset,
  scenePart: string,
): string {
  const scene = scenePart.trim();
  const cam = preset.cameraPromptEn.trim();
  if (scene && cam) return \`\${scene}, \${cam}\`;
  return scene || cam;
}
`;

fs.writeFileSync(outPath, out);
console.log(`[generate-camera-shot-catalog] ${presets.length} presets → ${outPath}`);
