import type { CanvasFlowNode } from "@/lib/canvas/types";

export const PRO2_SCRIPT_HUB_NODE_TYPE = "story-pro2-script-hub";

export function graphHasPro2ScriptHub(
  nodes: ReadonlyArray<Pick<CanvasFlowNode, "type">>,
): boolean {
  return nodes.some((n) => n.type === PRO2_SCRIPT_HUB_NODE_TYPE);
}
