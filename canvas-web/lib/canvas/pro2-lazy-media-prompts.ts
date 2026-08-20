import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProPropRow,
  StoryProSceneRow,
  StoryProAudioRow,
} from "./story-pro-workspace-types";
import type { CanvasFlowNode } from "./types";
import type { StoryProVisualStylePack } from "./story-pro-visual-style-pack";
import { finalizeStoryPro2SceneImagePrompt } from "./story-pro2-scene-image-prompt";
import { normalizePro2NegativePrompt } from "./pro2-chinese-prompt-normalize";
import { buildPro2ThreeViewDockPrompt } from "./three-view-prompt-rules";
import {
  isPro2ProductionPackCharacterImagePrompt,
  isPro2ProductionPackFrameImagePrompt,
  isPro2ProductionPackSceneImagePrompt,
  resolvePro2AudioMediaPromptFromRow,
  resolvePro2FrameImagePromptFromRow,
  resolvePro2PropMediaPromptFromRow,
  resolvePro2SceneMediaPromptFromRow,
  resolvePro2VideoPromptFromRow,
  finalizePro2SceneImageDockPrompt,
  finalizePro2PropImageDockPrompt,
  isLegacyWrappedMediaPrompt,
  isPro2ProductionPackPropImagePrompt,
  buildPro2CharacterVisualStyleTag,
  hasPro2ProductionPackVisualStyleTag,
} from "./pro2-production-pack-prompt";

function dialogueLine(dialogue?: string): string {
  const d = dialogue?.trim();
  if (!d || d === "—" || d === "-") return "";
  return `对白：${d}`;
}

function legacySceneRowMediaPrompt(row: StoryProSceneRow): string {
  const envTimeMood =
    [row.environment, row.time, row.mood].filter(Boolean).join(" · ") ||
    row.description?.trim() ||
    "";
  const parts = [
    row.name.trim() ? `场景：${row.name.trim()}` : "",
    envTimeMood ? `环境/时间/气氛：${envTimeMood}` : "",
    (row.imageKeywords ?? "").trim()
      ? `生图：${row.imageKeywords!.trim()}`
      : "",
    !row.imageKeywords?.trim() && row.description?.trim() && !envTimeMood
      ? `画面：${row.description.trim()}`
      : "",
  ].filter(Boolean);
  let prompt = finalizeStoryPro2SceneImagePrompt(parts.join("\n"));
  const neg = normalizePro2NegativePrompt(row.negativePrompt?.trim() ?? "");
  if (neg) prompt = `${prompt}\n【反向提示词】${neg}`;
  return prompt;
}

function legacyFrameRowMediaPrompt(row: StoryProFrameRow): string {
  const shotLine = row.shotSize?.trim() ? `景别：${row.shotSize.trim()}` : "";
  const lightingLine = row.lighting?.trim()
    ? `光影：${row.lighting.trim()}`
    : "";
  const parts = [
    `镜 ${row.frameIndex}`,
    shotLine,
    lightingLine,
    row.scene?.trim() ? `场景：${row.scene.trim()}` : "",
    row.description?.trim() ? `镜头描述：${row.description.trim()}` : "",
    dialogueLine(row.dialogue),
  ].filter(Boolean);
  return parts.join("\n");
}

/** 三视图 · 制作包 imagePrompt 透传，或 legacy 组装 */
export function buildPro2CharacterMediaPrompt(
  row: StoryProCharacterRow,
  visualPack?: StoryProVisualStylePack | null,
): string {
  return buildPro2ThreeViewDockPrompt(row, visualPack);
}

/** 场景图 · 制作包 imagePrompt 透传，或 legacy 空镜约束链 */
export function buildPro2SceneMediaPrompt(
  row: StoryProSceneRow,
  visualPack?: StoryProVisualStylePack | null,
): string {
  const passthrough = resolvePro2SceneMediaPromptFromRow(row);
  const finalizeOpts = {
    visualStylePack: visualPack ?? null,
    visualStyleTag: row.visualStyleTag,
  };
  if (
    passthrough &&
    !isLegacyWrappedMediaPrompt(passthrough) &&
    (isPro2ProductionPackSceneImagePrompt(passthrough) ||
      passthrough.includes("名称："))
  ) {
    return finalizePro2SceneImageDockPrompt(passthrough, finalizeOpts);
  }
  if (passthrough && !passthrough.includes("【场景空镜约束】")) {
    return passthrough;
  }
  const core =
    legacySceneRowMediaPrompt(row) ||
    row.description?.trim() ||
    "";
  let prompt = core;
  if (
    visualPack &&
    prompt.trim() &&
    !hasPro2ProductionPackVisualStyleTag(prompt)
  ) {
    const tag = buildPro2CharacterVisualStyleTag(
      visualPack,
      row.visualStyleTag,
    );
    if (tag) prompt = `${prompt}\n\n${tag}`;
  }
  return prompt;
}

/** 分镜图 · Pass2 frameImagePrompt 透传，或 legacy 分镜脚本拼装 */
export function buildPro2FrameMediaPrompt(row: StoryProFrameRow): string {
  const passthrough = resolvePro2FrameImagePromptFromRow(row);
  if (passthrough && isPro2ProductionPackFrameImagePrompt(passthrough)) {
    return passthrough;
  }
  if (passthrough) return passthrough;
  return legacyFrameRowMediaPrompt(row);
}

/** 分镜视频 · Pass2 videoPrompt 透传 */
export function buildPro2VideoMediaPrompt(row: StoryProFrameRow): string {
  return resolvePro2VideoPromptFromRow(row) ?? row.videoPrompt?.trim() ?? "";
}

/** 道具 · imagePrompt 透传 */
export function buildPro2PropMediaPrompt(
  row: StoryProPropRow,
  visualPack?: StoryProVisualStylePack | null,
): string {
  const passthrough = resolvePro2PropMediaPromptFromRow(row);
  if (
    passthrough &&
    !isLegacyWrappedMediaPrompt(passthrough) &&
    (isPro2ProductionPackPropImagePrompt(passthrough) ||
      passthrough.includes("名称："))
  ) {
    return finalizePro2PropImageDockPrompt(passthrough, {
      visualStylePack: visualPack ?? null,
    });
  }
  if (passthrough) return passthrough;
  return row.prompt?.trim() || row.description?.trim() || "";
}

/** 音效 · 描述透传 */
export function buildPro2AudioMediaPrompt(row: StoryProAudioRow): string {
  return resolvePro2AudioMediaPromptFromRow(row);
}

/** Dock 编辑后 · 写入角色列 row.prompt（后端 threeView 跑图读此字段） */
export function commitPro2ThreeViewRowPromptFromDock(
  characterColumnId: string,
  rowKey: string,
  prompt: string,
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  const key = rowKey.trim();
  if (!key) return false;
  const col = nodes.find((n) => n.id === characterColumnId);
  if (!col) return false;
  const rows = (col.data as { rows?: StoryProCharacterRow[] }).rows ?? [];
  const trimmed = prompt.trim();
  updateNodeData(characterColumnId, {
    rows: rows.map((row) =>
      row.key === key ? { ...row, prompt: trimmed } : row,
    ),
  });
  return true;
}

export function applyPro2CharacterMediaPromptsForKeys(
  rows: StoryProCharacterRow[],
  rowKeys: string[],
  visualPack?: StoryProVisualStylePack | null,
): StoryProCharacterRow[] {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return rows;
  return rows.map((row) =>
    allowed.has(row.key)
      ? { ...row, prompt: buildPro2CharacterMediaPrompt(row, visualPack) }
      : row,
  );
}

export function applyPro2SceneMediaPromptsForKeys(
  rows: StoryProSceneRow[],
  rowKeys: string[],
  visualPack?: StoryProVisualStylePack | null,
): StoryProSceneRow[] {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return rows;
  return rows.map((row) =>
    allowed.has(row.key)
      ? { ...row, prompt: buildPro2SceneMediaPrompt(row, visualPack) }
      : row,
  );
}

export function applyPro2PropMediaPromptsForKeys(
  rows: StoryProPropRow[],
  rowKeys: string[],
  visualPack?: StoryProVisualStylePack | null,
): StoryProPropRow[] {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return rows;
  return rows.map((row) =>
    allowed.has(row.key)
      ? { ...row, prompt: buildPro2PropMediaPrompt(row, visualPack) }
      : row,
  );
}

/** @param frameSupplement 仅用于分镜图专用补充（勿传剧本 hub dockInput） */
export function applyPro2FrameMediaPromptsForIndices(
  rows: StoryProFrameRow[],
  frameIndices: number[],
  frameSupplement?: string,
): StoryProFrameRow[] {
  const allowed = new Set(
    frameIndices.filter((n) => Number.isFinite(n) && n > 0),
  );
  if (!allowed.size) return rows;
  const note = frameSupplement?.trim();
  return rows.map((row) => {
    if (!allowed.has(row.frameIndex)) return row;
    let prompt = buildPro2FrameMediaPrompt(row);
    if (note) {
      prompt = `${prompt}\n\n用户补充：${note}`.trim();
    }
    return { ...row, prompt };
  });
}

/** 分镜视频列 · 同步 Pass2 videoPrompt 到 videoPrompt 字段 */
export function applyPro2VideoMediaPromptsForIndices(
  rows: StoryProFrameRow[],
  frameIndices: number[],
): StoryProFrameRow[] {
  const allowed = new Set(
    frameIndices.filter((n) => Number.isFinite(n) && n > 0),
  );
  if (!allowed.size) return rows;
  return rows.map((row) =>
    allowed.has(row.frameIndex)
      ? { ...row, videoPrompt: buildPro2VideoMediaPrompt(row) }
      : row,
  );
}
