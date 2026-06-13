import { isPro2MediaChildNode } from "./pro2-media-group-meta";
import type { CanvasFlowNode } from "./types";

/** 组保存为资产：收拢 parentId / pro2GroupId / controller 关联的全部媒体子节点 */
export function collectGroupChildNodesForAssetExport(
  groupId: string,
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  const controllerId = (group?.data as { pro2ControllerNodeId?: string })
    ?.pro2ControllerNodeId;

  const seen = new Set<string>();
  const out: CanvasFlowNode[] = [];

  const push = (n: CanvasFlowNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    out.push(n);
  };

  for (const n of nodes) {
    if (n.parentId === groupId) push(n);
  }

  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const d = n.data as { pro2GroupId?: string; pro2ControllerNodeId?: string };
    if (d.pro2GroupId === groupId && isPro2MediaChildNode(n)) {
      push(n);
      continue;
    }
    if (
      controllerId &&
      d.pro2ControllerNodeId === controllerId &&
      isPro2MediaChildNode(n)
    ) {
      push(n);
    }
  }

  return out;
}
