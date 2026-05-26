/**
 * React Flow 交互类名
 * @see https://reactflow.dev/api-reference/react-flow#nowheel
 */
export const RF_NO_DRAG = "nodrag";
export const RF_NO_WHEEL = "nowheel";
/** 节点标题栏 · 从此处拖动画布上的节点 */
export const RF_NODE_DRAG_HANDLE = "canvas-node-drag-handle";
/** 节点内可滚动 / 可编辑区域：不拖拽节点、不触发画布缩放 */
export const RF_NODE_SCROLL = `${RF_NO_DRAG} ${RF_NO_WHEEL}`;
