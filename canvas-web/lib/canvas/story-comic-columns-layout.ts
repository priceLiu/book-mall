import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";
import {
  STORY_GROUP_CHARACTERS,
  STORY_GROUP_FRAMES,
  STORY_GROUP_VIDEOS,
  hasStoryComicColumnGroups,
} from "./story-comic-groups";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import { layoutStoryTemplateGroups, fitGroupBoundsToChildren } from "./normalize-graph-nodes";
import { hasStoryComicPipeline } from "./story-comic-layout";

const COL_GAP = 560;
const ROW_ENGINE_ABOVE = 48;

/** 三列 group 模式：控制区 + 角色列 + 分镜列 + 视频列 + 导出 */
export function reflowStoryComicColumns(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): CanvasFlowNode[] {
  if (!hasStoryComicPipeline(nodes) || !hasStoryComicColumnGroups(nodes)) {
    return nodes;
  }

  const starter = nodes.find((n) => n.type === "story-comic-starter");
  const outline = nodes.find((n) => n.type === "story-outline-engine");
  const character = nodes.find((n) => n.type === "character-engine");
  const storyboard = nodes.find((n) => n.type === "storyboard-engine");
  const exportNode = nodes.find((n) => n.type === "jianying-export");

  const charGroup = nodes.find((n) => n.id === STORY_GROUP_CHARACTERS);
  const framesGroup = nodes.find((n) => n.id === STORY_GROUP_FRAMES);
  const videosGroup = nodes.find((n) => n.id === STORY_GROUP_VIDEOS);

  const origin = starter?.position ?? { x: 80, y: 120 };

  let next = nodes.map((n) => {
    if (isGroupNode(n.type)) {
      if (n.id === STORY_GROUP_CHARACTERS) {
        return {
          ...n,
          position: { x: origin.x + COL_GAP, y: origin.y + 120 },
        } as CanvasFlowNode;
      }
      if (n.id === STORY_GROUP_FRAMES) {
        return {
          ...n,
          position: { x: origin.x + COL_GAP * 2, y: origin.y + 120 },
        } as CanvasFlowNode;
      }
      if (n.id === STORY_GROUP_VIDEOS) {
        return {
          ...n,
          position: { x: origin.x + COL_GAP * 3, y: origin.y + 120 },
        } as CanvasFlowNode;
      }
      return n;
    }

    if (n.type === "story-comic-starter") {
      return { ...n, position: { x: origin.x, y: origin.y } } as CanvasFlowNode;
    }
    if (n.type === "story-outline-engine" && outline) {
      return {
        ...n,
        position: { x: origin.x, y: origin.y + 380 },
      } as CanvasFlowNode;
    }
    if (n.type === "character-engine" && character && charGroup) {
      return {
        ...n,
        position: {
          x: charGroup.position.x,
          y: charGroup.position.y - ROW_ENGINE_ABOVE - nodeMeasuredSize(n).h,
        },
        parentId: undefined,
        extent: undefined,
      } as CanvasFlowNode;
    }
    if (n.type === "storyboard-engine" && storyboard && framesGroup) {
      return {
        ...n,
        position: {
          x: framesGroup.position.x,
          y: framesGroup.position.y - ROW_ENGINE_ABOVE - nodeMeasuredSize(n).h,
        },
        parentId: undefined,
        extent: undefined,
      } as CanvasFlowNode;
    }
    if (n.type === "jianying-export" && exportNode && videosGroup) {
      return {
        ...n,
        position: {
          x: videosGroup.position.x + 400,
          y: videosGroup.position.y,
        },
        parentId: undefined,
        extent: undefined,
      } as CanvasFlowNode;
    }

    return n;
  });

  next = layoutStoryTemplateGroups(next);
  next = fitGroupBoundsToChildren(next);
  return sortNodesForReactFlow(next);
}
