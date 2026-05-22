// story-web 三期 · 漫剧风格目录（来自 story-web/src/shared/styles/index.json 的副本）
// 同步：pnpm story:sync-styles（CI 加 --check 防漂移）
import stylesJson from "./styles.json";

export type StoryComicStyle = {
  id: number;
  name: string;
  name_cn: string;
  prompt: string;
  type: string;
  type_cn: string;
  url: string;
};

export const STORY_COMIC_STYLES: StoryComicStyle[] = stylesJson as StoryComicStyle[];

export function getStoryStyleById(id: number): StoryComicStyle | null {
  return STORY_COMIC_STYLES.find((s) => s.id === id) ?? null;
}

/** 取风格的 prompt 段（用于实时拼接到角色/分镜图 prompt 头部）；找不到时返回空字符串 */
export function getStoryStylePrompt(id: number): string {
  return getStoryStyleById(id)?.prompt ?? "";
}

/** 校验 styleId 是否合法（用于建项目时的入参校验） */
export function isValidStoryStyleId(id: unknown): id is number {
  return (
    typeof id === "number" &&
    Number.isInteger(id) &&
    STORY_COMIC_STYLES.some((s) => s.id === id)
  );
}
