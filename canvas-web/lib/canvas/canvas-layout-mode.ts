import type { CanvasFlowNode } from "./types";
import { hasStoryPro2Pipeline } from "./story-pro2-pipeline";
import { hasSbv1Pipeline } from "./sbv1-pipeline";

/** 画布外壳：决定 FlowCanvas flags 与底部 Dock 套件 */
export type CanvasLayoutShell = "pro2" | "sbv1" | "legacy";

/**
 * Pro2 项目可混用 sbv1 媒体节点（反推 / 文生视频预设），
 * 外壳须以 **项目 edition / Pro2 流水线** 为准，不能因单个 sbv1 节点切到 sbv1 布局。
 */
export function resolveCanvasLayoutShell(args: {
  projectEdition?: string | null;
  nodes: CanvasFlowNode[];
}): CanvasLayoutShell {
  const { projectEdition, nodes } = args;
  if (projectEdition === "pro2" || hasStoryPro2Pipeline(nodes)) {
    return "pro2";
  }
  if (projectEdition === "sbv1" || hasSbv1Pipeline(nodes)) {
    return "sbv1";
  }
  return "legacy";
}
