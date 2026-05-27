import type { CanvasNodeType } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
} from "./story-node-chrome";

/** 工作区列横向间距（与 story-comic-workspace-layout 一致） */
export const STORY_WORKSPACE_COL_H_GAP = 120;

const MEDIA_COLUMN_TYPES = [
  "story-character-column",
  "story-frame-column",
  "story-video-column",
  "jianying-export",
] as const satisfies readonly CanvasNodeType[];

/** 单套工作流 · 控制行节点宽度（主题 + 大纲） */
export function storyControlNodeWidth(): number {
  return STORY_CONTROL_NODE_WIDTH;
}

/** 媒体列 + 剪映导出 · 固定宽度序列（用于 spawn / reflow） */
export function storyMediaColumnWidths(): number[] {
  return MEDIA_COLUMN_TYPES.map(
    (t) => NODE_DEFAULT_SIZE[t]?.width ?? 400,
  );
}

/** 媒体列 + 剪映 · 累计 X（从大纲节点右缘起） */
export function storyMediaColumnXs(hubLeftX: number): number[] {
  let x = hubLeftX + STORY_CONTROL_NODE_WIDTH + STORY_WORKSPACE_COL_H_GAP;
  return storyMediaColumnWidths().map((w) => {
    const left = x;
    x += w + STORY_WORKSPACE_COL_H_GAP;
    return left;
  });
}

/** 控制行底边 Y（Starter 顶为 originY） */
export function storyControlRowBottom(originY: number): number {
  return originY + STORY_CONTROL_NODE_HEIGHT;
}

/** 底对齐放置时的 top Y（三列媒体） */
export function storyBottomAlignedY(
  rowBottom: number,
  nodeType: CanvasNodeType,
): number {
  const h = NODE_DEFAULT_SIZE[nodeType]?.height ?? 400;
  return rowBottom - h;
}

/** 工作区节点 Y：三列媒体底对齐控制行底；剪映顶对齐控制行（与主题/大纲同高） */
export function storyMediaColumnY(
  originY: number,
  rowBottom: number,
  nodeType: CanvasNodeType | string,
): number {
  if (nodeType === "jianying-export" || nodeType === "jianying-export-pro") {
    return originY;
  }
  return storyBottomAlignedY(rowBottom, nodeType as CanvasNodeType);
}
