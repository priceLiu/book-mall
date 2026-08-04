import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
} from "./story-pro-workspace-types";
import type { StoryProVisualStylePack } from "./story-pro-visual-style-pack";
import { finalizeStoryPro2SceneImagePrompt } from "./story-pro2-scene-image-prompt";
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
  const neg = row.negativePrompt?.trim();
  if (neg) prompt = `${prompt}\n【反向提示词】${neg}`;
  return prompt;
}

function buildFrameRowMediaPrompt(row: StoryProFrameRow): string {
  const fromPack = row.aiImagePrompt?.trim();
  if (fromPack) return fromPack;
  const parts = [
    `镜 ${row.frameIndex}`,
    row.shotSize?.trim() ? `景别：${row.shotSize.trim()}` : "",
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

export function applyPro2FrameMediaPromptsForIndices(
  rows: StoryProFrameRow[],
  frameIndices: number[],
  dockNote?: string,
): StoryProFrameRow[] {
  const allowed = new Set(
    frameIndices.filter((n) => Number.isFinite(n) && n > 0),
  );
  if (!allowed.size) return rows;
  const note = dockNote?.trim();
  return rows.map((row) => {
    if (!allowed.has(row.frameIndex)) return row;
    let prompt = buildPro2FrameMediaPrompt(row);
    if (note) {
      prompt = `${prompt}\n\n用户补充：${note}`.trim();
    }
    return { ...row, prompt };
  });
}
