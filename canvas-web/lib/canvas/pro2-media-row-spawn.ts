import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
} from "./story-pro-workspace-types";
import { isLegacyWrappedMediaPrompt } from "./pro2-production-pack-prompt";
import { shouldRebuildPro2CharacterRowPrompt } from "./three-view-prompt-rules";

function isFrameScriptPrompt(prompt: string): boolean {
  const p = prompt.trim();
  if (!p) return false;
  if (/^镜\s*\d/m.test(p)) return true;
  return (
    p.includes("镜头描述：") ||
    p.includes("运镜：") ||
    p.includes("对白：")
  );
}

/** 按 rowKey 过滤待 spawn 的行（hub 多选生成时仅建选中节点） */
export function filterPro2RowsForSpawn<T extends { key: string }>(
  rows: T[],
  rowKeys?: string[],
): T[] {
  const allowed = rowKeys?.filter(Boolean);
  if (!allowed?.length) return rows;
  const set = new Set(allowed);
  return rows.filter((r) => set.has(r.key));
}

/** @deprecated 使用 filterPro2RowsForSpawn */
export const filterPro2CharacterRowsForSpawn = filterPro2RowsForSpawn;

/** 分镜组 · 按镜号过滤待 spawn 的行 */
export function filterPro2FrameRowsForSpawn(
  rows: StoryProFrameRow[],
  frameIndices?: number[],
): StoryProFrameRow[] {
  const allowed = frameIndices?.filter((n) => Number.isFinite(n) && n > 0);
  if (!allowed?.length) return rows;
  const set = new Set(allowed);
  return rows.filter((r) => set.has(r.frameIndex));
}

export type Pro2MediaRowKind = "character" | "scene" | "frame";

function pro2SceneTableFingerprint(row: StoryProSceneRow): string {
  return [
    row.name,
    row.environment ?? "",
    row.time ?? "",
    row.mood ?? "",
    row.imageKeywords ?? "",
    row.negativePrompt ?? "",
    row.description ?? "",
  ].join("\x1e");
}

function pro2FrameTableFingerprint(row: StoryProFrameRow): string {
  return [
    row.scene,
    row.shotSize ?? "",
    row.description,
    row.dialogue ?? "",
    row.aiImagePrompt ?? "",
    row.videoPrompt ?? "",
  ].join("\x1e");
}

/** 剧本 hub 同步后保留已生成 prompt；表字段变更则清空，等待用户再次点「生成」 */
export function preservePro2MediaRowPrompt<
  T extends StoryProCharacterRow | StoryProSceneRow | StoryProFrameRow,
>(prev: T | undefined, next: T, kind: Pro2MediaRowKind): string {
  if (!prev?.prompt?.trim()) return "";
  if (kind === "character") {
    return shouldRebuildPro2CharacterRowPrompt(
      prev as StoryProCharacterRow,
      next as StoryProCharacterRow,
    )
      ? ""
      : prev.prompt.trim();
  }
  if (kind === "scene") {
    if (isFrameScriptPrompt(prev.prompt)) return "";
    return pro2SceneTableFingerprint(prev as StoryProSceneRow) ===
      pro2SceneTableFingerprint(next as StoryProSceneRow)
      ? prev.prompt.trim()
      : "";
  }
  return pro2FrameTableFingerprint(prev as StoryProFrameRow) ===
    pro2FrameTableFingerprint(next as StoryProFrameRow)
    ? prev.prompt.trim()
    : "";
}
