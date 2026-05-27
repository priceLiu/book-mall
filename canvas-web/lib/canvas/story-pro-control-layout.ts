/**
 * 影视专业版 · 控制行 X 坐标（starter → hub → style，避免 480 步进重叠）
 */
import { STORY_WORKSPACE_COL_H_GAP } from "./story-workspace-layout";
import { STORY_PRO_CONTROL_NODE_WIDTH } from "./story-pro-node-chrome";

export function storyProControlRowX(starterLeftX: number): {
  hubX: number;
  styleX: number;
} {
  const w = STORY_PRO_CONTROL_NODE_WIDTH;
  const gap = STORY_WORKSPACE_COL_H_GAP;
  const hubX = starterLeftX + w + gap;
  const styleX = hubX + w + gap;
  return { hubX, styleX };
}

/** 媒体列起始 X：紧贴控制行最右节点 */
export function storyProMediaColumnStartX(controlRightNodeLeftX: number): number {
  return controlRightNodeLeftX + STORY_PRO_CONTROL_NODE_WIDTH + STORY_WORKSPACE_COL_H_GAP;
}
