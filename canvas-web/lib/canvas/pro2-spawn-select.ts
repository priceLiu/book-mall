/** + 菜单生成节点后选中、聚焦视口（LibTV 选中态只写 RF，勿写 store.selected） */
export function selectPro2NodeAfterSpawn(
  _setNodes: unknown,
  nodeId: string,
): void {
  if (!nodeId) return;
  queueMicrotask(() => {
    void import("./store").then(({ useCanvasStore }) => {
      useCanvasStore.getState().focusCanvasNode(nodeId);
    });
  });
}

/** @deprecated 别名 · 与 selectPro2NodeAfterSpawn 相同 */
export const focusNodeAfterSpawn = selectPro2NodeAfterSpawn;
