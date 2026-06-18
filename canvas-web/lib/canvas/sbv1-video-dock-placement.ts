import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import { PRO2_DOCK_WIDTH } from "./story-pro2-node-chrome";

/** sbv1 视频引擎浮动 Dock · 锚点选项（稳定引用，勿在 render 内 inline 创建） */
export const SBV1_VIDEO_DOCK_PLACEMENT_OPTS = {
  minFlowWidth: PRO2_DOCK_WIDTH,
  defaultNodeWidth: SBV1_VIDEO_ENGINE_WIDTH,
} as const;
