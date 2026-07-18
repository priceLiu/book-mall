/** 自动成片 Dock · 恒定屏幕尺寸（px · 随画布 zoom 逆缩放保持恒定） */
export const JIANYING_AUTO_RENDER_DOCK_SCREEN_W = 800;
/** 含顺序条 + 底部进度条；320 会裁切进度条 */
export const JIANYING_AUTO_RENDER_DOCK_SCREEN_H = 400;

/** flow 坐标基准（与屏宽 1:1 · 由 inverse-scale 抵消 zoom） */
export const JIANYING_AUTO_RENDER_DOCK_FLOW_W = JIANYING_AUTO_RENDER_DOCK_SCREEN_W;
export const JIANYING_AUTO_RENDER_DOCK_FLOW_H = JIANYING_AUTO_RENDER_DOCK_SCREEN_H;

/** 自动成片浮动 Dock · 锚点选项（稳定引用） */
export const JIANYING_AUTO_RENDER_DOCK_PLACEMENT_OPTS = {
  minFlowWidth: 0,
  defaultNodeWidth: 720,
  defaultNodeHeight: 840,
} as const;
