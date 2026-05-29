import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import type { StoryCharacterRow } from "./story-workspace-types";

export type { MentionableItem };

export type StoryRefImage = {
  id: string;
  label: string;
  url?: string;
};

export function storyRefMentionToken(refId: string): string {
  return `@<${refId}>`;
}

export function storyRefIdsFromPrompt(prompt: string): string[] {
  return parseReferencedIds(prompt);
}

export function storyRefMentionables(refImages: StoryRefImage[]): MentionableItem[] {
  return refImages.map((r) => ({
    id: r.id,
    label: r.label,
    kind: "image",
    previewUrl: r.url,
  }));
}

/** 角色列全量三视图目录（含未出图条目，供解析 @ 与同步 URL） */
export function storyCharacterRefCatalog(
  characterRows: StoryCharacterRow[],
  assetRefsByKey?: Record<string, StoryRefImage[]>,
): StoryRefImage[] {
  const out: StoryRefImage[] = [];
  for (const c of characterRows) {
    const assetRefs = assetRefsByKey?.[c.key];
    if (assetRefs?.length) {
      out.push(...assetRefs);
      continue;
    }
    out.push({
      id: `ref-char-${c.key}`,
      label: c.name,
      url: c.runtime?.ossUrl ?? c.runtime?.ephemeralUrl,
    });
  }
  return out;
}

/** @ 菜单：仅已生成出图的角色三视图（含缩略图） */
export function storyGeneratedCharacterMentionables(
  characterRows: StoryCharacterRow[],
): MentionableItem[] {
  const out: MentionableItem[] = [];
  for (const c of characterRows) {
    const url = c.runtime?.ossUrl ?? c.runtime?.ephemeralUrl;
    if (!url || !/^https?:\/\//.test(url)) continue;
    out.push({
      id: `ref-char-${c.key}`,
      label: c.name,
      kind: "image",
      previewUrl: url,
    });
  }
  return out;
}

/** 按提示词中的 @ 解析参考图列表（顺序与 @ 一致） */
export function storyRefImagesFromPrompt(
  prompt: string,
  catalog: StoryRefImage[],
): StoryRefImage[] {
  const ids = storyRefIdsFromPrompt(prompt);
  if (!ids.length) return [];
  const byId = new Map(catalog.map((r) => [r.id, r]));
  return ids.map((id) => {
    const hit = byId.get(id);
    if (hit) return { ...hit };
    return { id, label: id.replace(/^ref-char-/, ""), url: undefined };
  });
}

export function storyRefUrlsForPrompt(
  prompt: string,
  refImages: StoryRefImage[] | undefined,
): string[] {
  if (!refImages?.length) return [];
  const byId = new Map(
    refImages
      .filter((r) => r.url && /^https?:\/\//.test(r.url))
      .map((r) => [r.id, r.url!]),
  );
  const fromMentions = storyRefIdsFromPrompt(prompt)
    .map((id) => byId.get(id))
    .filter((u): u is string => Boolean(u));
  if (fromMentions.length) return fromMentions;
  return Array.from(byId.values());
}

export const STORY_ROW_LABEL_COL_WIDTH = 56;
/** 分镜列 · 上游参考图列宽 */
export const STORY_UPSTREAM_COL_WIDTH = 220;
/** @deprecated 分镜行参考图已改为单槽 fill + 左右切换；保留常量避免旧 import 报错 */
export const STORY_UPSTREAM_REF_GRID_COLS = 3;
/** 角色/分镜列 · 输出图列宽 */
export const STORY_MEDIA_COL_WIDTH = 248;
