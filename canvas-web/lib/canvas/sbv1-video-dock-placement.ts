import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
/** sbv1 视频引擎浮动 Dock · 锚点选项（稳定引用，勿在 render 内 inline 创建） */
export const SBV1_VIDEO_DOCK_PLACEMENT_OPTS = {
  minFlowWidth: 0,
  defaultNodeWidth: SBV1_VIDEO_ENGINE_WIDTH,
} as const;
