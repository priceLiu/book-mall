import { memo, type ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";

/** React Flow 节点 memo：忽略无关节点的坐标变化，减少拖动/平移时整图重绘 */
export function memoFlowNode<P extends NodeProps>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return memo(Component, (prev, next) => {
    if (prev.id !== next.id) return false;
    if (prev.type !== next.type) return false;
    if (prev.selected !== next.selected) return false;
    if (prev.dragging !== next.dragging) return false;
    if (prev.data !== next.data) return false;
    if (prev.zIndex !== next.zIndex) return false;
    if (prev.parentId !== next.parentId) return false;
    if (prev.width !== next.width) return false;
    if (prev.height !== next.height) return false;
    return true;
  }) as unknown as ComponentType<P>;
}
