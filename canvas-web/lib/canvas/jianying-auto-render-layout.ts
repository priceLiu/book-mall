import { scheduleRelayoutSbv1MediaGroup } from "./sbv1-media-group-layout";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import { stripAutoRenderMediaFitReset } from "./jianying-auto-render-media-fit";
import { useCanvasStore } from "./store";

export { stripAutoRenderMediaFitReset } from "./jianying-auto-render-media-fit";

/** 自动成片 · 成片就绪后保留外框，禁止 reset mediaFit 触发 635 缩框 */
export function preserveAutoRenderNodeMediaFitPatch(
  nodeId: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const nodeType = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)?.type;
  return stripAutoRenderMediaFitReset(nodeType, patch);
}

/** sbv1 媒体组内 · 成片尺寸变化后重排组内兄弟节点 */
export function scheduleAutoRenderParentGroupRelayout(nodeId: string): void {
  const state = useCanvasStore.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  const parentId = node?.parentId;
  if (!parentId) return;
  const parent = state.nodes.find((n) => n.id === parentId);
  if (!parent || !isSbv1MediaGroup(parent, state.nodes)) return;
  scheduleRelayoutSbv1MediaGroup(
    state.setNodes,
    parentId,
    () => useCanvasStore.getState().edges,
    0,
  );
}
