import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
} from "./story-pro-workspace-types";
import type { CanvasFlowNode } from "./types";
import type { StoryProVisualStylePack } from "./story-pro-visual-style-pack";
import { finalizeStoryPro2SceneImagePrompt } from "./story-pro2-scene-image-prompt";
import { normalizePro2NegativePrompt } from "./pro2-chinese-prompt-normalize";
import { buildPro2ThreeViewDockPrompt } from "./three-view-prompt-rules";
import { appendVisualStylePackToDockPrompt } from "./story-pro-visual-style-pack";

function dialogueLine(dialogue?: string): string {
  const d = dialogue?.trim();
  if (!d || d === "—" || d === "-") return "";
  return `对白：${d}`;
}

function formatSceneRowForMediaPrompt(row: StoryProSceneRow): string {
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

function buildFrameRowMediaPrompt(row: StoryProFrameRow): string {
  const pass2 =
    row.frameImagePrompt?.trim() ||
    row.aiImagePrompt?.trim();
  const shotLine = row.shotSize?.trim() ? `景别：${row.shotSize.trim()}` : "";
  if (pass2) {
    return [shotLine, pass2].filter(Boolean).join("\n");
  }
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

/** 三视图 · 仅对用户选中的角色行组装 Dock / 列 prompt */
export function buildPro2CharacterMediaPrompt(
  row: StoryProCharacterRow,
  visualPack?: StoryProVisualStylePack | null,
): string {
  return buildPro2ThreeViewDockPrompt(row, visualPack);
}

/** 场景图 · 仅对用户选中的场景行组装 prompt */
export function buildPro2SceneMediaPrompt(
  row: StoryProSceneRow,
  visualPack?: StoryProVisualStylePack | null,
): string {
  const core =
    formatSceneRowForMediaPrompt(row) ||
    row.description?.trim() ||
    "";
  return appendVisualStylePackToDockPrompt(core, visualPack ?? undefined);
}

/** 分镜图 · 仅对用户选中的分镜行组装 prompt */
export function buildPro2FrameMediaPrompt(row: StoryProFrameRow): string {
  return buildFrameRowMediaPrompt(row);
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
