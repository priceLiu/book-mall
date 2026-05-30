/**
 * React Flow 交互类名
 * @see https://reactflow.dev/api-reference/react-flow#nowheel
 */
export const RF_NO_DRAG = "nodrag";
export const RF_NO_WHEEL = "nowheel";
/** 节点标题栏 · 从此处拖动画布上的节点 */
export const RF_NODE_DRAG_HANDLE = "canvas-node-drag-handle";
/** 节点内可滚动区域：不拖拽节点；滚轮仍驱动画布平移（与空白处一致） */
export const RF_NODE_SCROLL = RF_NO_DRAG;

/** React Flow 节点 dragHandle 选择器（写入 node.dragHandle，避免每帧 map 全图） */
export const RF_NODE_DRAG_HANDLE_SELECTOR = `.${RF_NODE_DRAG_HANDLE}`;

/**
 * 文本框 / 下拉：仅 `nodrag`（勿加 `nowheel`，否则滚轮无法平移画布）。
 * 滚轮由 {@link onCanvasFormWheel} 拦截内容滚动，超长内容用滚动条。
 */
export const RF_FORM_CONTROL = RF_NO_DRAG;
