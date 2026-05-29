/** 分镜脚本 / 分镜视频 · 行间距 */
export const STORY_MEDIA_GRID_GAP = 12;

/** 分镜列 · 单列显示 */
export const STORY_MEDIA_LIST_COLUMNS = 1;

/** 分镜视频 · 单列内容区参考宽（540 列 − 内边距） */
export const STORY_VIDEO_CELL_WIDTH = 516;

/**
 * 分镜脚本 · 单列内容区参考宽（1080 列 − 内边距）
 * @deprecated 单列布局下由节点 w-full 撑满，仅保留兼容引用
 */
export const STORY_FRAME_CELL_WIDTH = 1056;

export function storyMediaListColumns(): number {
  return STORY_MEDIA_LIST_COLUMNS;
}

export function storyMediaListLabel(frameCount: number): string {
  if (frameCount <= 0) return "等待分镜";
  return `${frameCount} 镜`;
}

/** @deprecated 使用 {@link storyMediaListLabel} */
export const storyMediaGridLabel = storyMediaListLabel;

/** @deprecated 使用 {@link storyMediaListLabel} */
export const storyFrameGridLabel = storyMediaListLabel;

/** @deprecated 使用 {@link storyMediaListColumns} */
export const storyMediaGridColumns = storyMediaListColumns;

/** @deprecated 使用 {@link storyMediaListColumns} */
export const storyFrameGridColumns = storyMediaListColumns;

/** @deprecated 宫格已改为单列 */
export const STORY_FRAME_GRID_COLUMNS = STORY_MEDIA_LIST_COLUMNS;
