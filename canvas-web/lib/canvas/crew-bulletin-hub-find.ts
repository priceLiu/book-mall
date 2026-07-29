import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { CanvasFlowNode } from "./types";

export function findScriptStudioHub(
  nodes: CanvasFlowNode[],
): CanvasFlowNode | undefined {
  return nodes.find(
    (n) =>
      n.type === "story-pro2-script-hub" &&
      (n.data as StoryProScriptHubNodeData).scriptStudioMode === true,
  );
}

/** 公告条锚点 hub：优先 script-studio；否则任意已发布 script-hub */
export function findCrewBulletinHub(
  nodes: CanvasFlowNode[],
): CanvasFlowNode | undefined {
  const studio = findScriptStudioHub(nodes);
  if (studio) return studio;
  return nodes.find((n) => {
    if (n.type !== "story-pro2-script-hub") return false;
    const d = n.data as StoryProScriptHubNodeData;
    return (
      d.scriptPublished === true ||
      Boolean(d.crewBulletin?.tasks?.length)
    );
  });
}
