import {
  isWan26BailianR2vModel,
  isWan27BailianR2vModel,
} from "@/lib/canvas/bailian-r2v-body";
import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
import {
  getStoryboardCharacterRefs,
  getStoryboardProductRef,
  getStoryboardSceneRefs,
} from "@/lib/ecom/ecom-storyboard-refs";

type StoryboardPanel = StoryboardSheet["panels"][number];

/** 说明多图参考顺序（首帧分镜图 + 产品/角色/场景 + 各镜头分镜图） */
export function buildStoryboardFullVideoRefGuide(
  references: StoryboardReference[],
  panelCount = 0,
): string {
  const parts: string[] = ["[REFERENCE IMAGES]"];
  parts.push("Image 1 (first_frame): full storyboard sheet — follow shot layout and pacing.");
  let idx = 2;
  const product = getStoryboardProductRef(references);
  if (product) {
    parts.push(`Image ${idx} (reference_image): product packshot — keep product appearance exact.`);
    idx += 1;
  }
  const chars = getStoryboardCharacterRefs(references);
  for (let i = 0; i < chars.length; i++) {
    parts.push(
      `Image ${idx + i} (reference_image): character reference ${chars.length > 1 ? i + 1 : ""} — match face, hair, outfit.`,
    );
  }
  idx += chars.length;
  const scenes = getStoryboardSceneRefs(references);
  for (let i = 0; i < scenes.length; i++) {
    parts.push(
      `Image ${idx + i} (reference_image): scene reference — match environment and lighting.`,
    );
  }
  idx += scenes.length;
  if (panelCount > 0) {
    parts.push(
      `Images ${idx}–${idx + panelCount - 1} (reference_image): per-shot storyboard frames — match each shot's composition, characters, and product placement.`,
    );
  }
  return parts.join("\n");
}

/** 各百炼 R2V 模型实际接收的参考图上限（须与 buildBailianR2vRequestBody 切片一致） */
export function bailianR2vRefCap(modelKey: string): number {
  if (isWan27BailianR2vModel(modelKey)) return 5; // media
  if (isWan26BailianR2vModel(modelKey)) return 5; // reference_urls
  return 9; // happyhorse: media
}

/** 百炼 R2V：按模型要求标注 reference 顺序（数量须与实际发送一致） */
export function buildBailianR2vRefGuide(
  modelKey: string,
  refCount: number,
): string {
  const count = Math.min(Math.max(0, refCount), bailianR2vRefCap(modelKey));
  if (count < 1) return "";
  if (isWan27BailianR2vModel(modelKey)) {
    const labels = Array.from({ length: count }, (_, i) =>
      i === 0 ? "图1=完整分镜图" : `图${i + 1}=参考图${i}`,
    );
    return `[百炼 wan2.7-r2v] ${labels.join("；")}。按分镜顺序生成带货短片。`;
  }
  if (isWan26BailianR2vModel(modelKey)) {
    const labels = Array.from({ length: count }, (_, i) =>
      i === 0 ? "character1=完整分镜图" : `character${i + 1}=参考图${i}`,
    );
    return `[百炼 wan2.6-r2v] ${labels.join("；")}。多镜头带货短片。`;
  }
  return `[百炼 R2V] 共 ${count} 张 reference_image（media），图1 为完整分镜图，其余为产品/角色/场景参考。`;
}

export function buildEcomStoryboardVideoPrompt(
  sheet: StoryboardSheet,
  brief?: { productHighlight?: string; style?: string },
  references?: StoryboardReference[],
  opts?: { bailianModelKey?: string; bailianRefCount?: number },
): string {
  const lines: string[] = [
    "Generate a single cohesive e-commerce micro-drama product video following this storyboard sheet exactly.",
    `Title: ${sheet.overview.title}`,
    `Logline: ${sheet.overview.logline}`,
  ];
  const highlight =
    sheet.overview.productHighlight?.trim() ||
    brief?.productHighlight?.trim();
  if (highlight) {
    lines.push(`Product highlight: ${highlight}`);
  }
  if (brief?.style?.trim()) {
    lines.push(`Visual style: ${brief.style.trim()}`);
  }
  if (sheet.cast.length) {
    lines.push("Cast:");
    for (const c of sheet.cast) {
      lines.push(`- ${c.name} (${c.role})`);
    }
  }
  lines.push("Shots (in order):");
  for (const p of sheet.panels) {
    const parts = [
      `#${p.index} ${p.shotType}`,
      `Scene: ${p.scene}`,
      `Action: ${p.action}`,
    ];
    if (p.dialogue?.trim()) parts.push(`Dialogue: ${p.dialogue.trim()}`);
    if (p.camera?.trim()) parts.push(`Camera: ${p.camera.trim()}`);
    if (p.durationHintSec) parts.push(`~${p.durationHintSec}s`);
    if (p.videoPromptEn?.trim()) parts.push(`Prompt: ${p.videoPromptEn.trim()}`);
    lines.push(parts.join(" | "));
  }
  if (sheet.totalDurationHintSec) {
    lines.push(`Target total duration: ~${sheet.totalDurationHintSec} seconds.`);
  }
  lines.push(
    "Maintain character and product consistency. Smooth transitions between shots. Cinematic lighting, commercial quality.",
  );
  const panelRefCount = sheet.panels.filter((p) => Boolean(p.imageUrl?.trim())).length;
  if (opts?.bailianModelKey && opts.bailianRefCount) {
    lines.push(buildBailianR2vRefGuide(opts.bailianModelKey, opts.bailianRefCount));
  } else if (references?.length || panelRefCount > 0) {
    lines.push(buildStoryboardFullVideoRefGuide(references ?? [], panelRefCount));
  }
  return lines.join("\n");
}

export function buildEcomStoryboardPanelVideoPrompt(
  panel: StoryboardPanel,
  sheet: StoryboardSheet,
  brief?: { productHighlight?: string; style?: string },
): string {
  const highlight =
    sheet.overview.productHighlight?.trim() ||
    brief?.productHighlight?.trim();
  const lines = [
    "Generate a single storyboard shot clip for e-commerce micro-drama product video.",
    `Title: ${sheet.overview.title}`,
    highlight ? `Product highlight: ${highlight}` : "",
    `Shot #${panel.index} | ${panel.shotType}`,
    `Scene: ${panel.scene}`,
    `Action: ${panel.action}`,
    panel.emotion ? `Emotion: ${panel.emotion}` : "",
    panel.camera ? `Camera: ${panel.camera}` : "",
    panel.dialogue?.trim() ? `Dialogue: ${panel.dialogue.trim()}` : "",
    panel.durationHintSec
      ? `Target duration: ~${panel.durationHintSec} seconds.`
      : "Target duration: ~3 seconds.",
    "Maintain product and character consistency. Commercial UGC quality.",
  ].filter(Boolean);
  return lines.join("\n");
}
