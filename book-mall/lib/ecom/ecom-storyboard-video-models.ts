import { isDashscopeKlingV3VideoGatewayModel } from "@/lib/canvas/dashscope-kling-v3-video";
import {
  dashscopeSbv1T2vModelToR2v,
  isDashscopeHappyhorseImageToVideoModel,
} from "@/lib/canvas/dashscope-sbv1-t2v";
import { BAILIAN_R2V_MODEL_IDS } from "@/lib/canvas/providers/bailian-r2v";
import { isVolcengineStoryVideoModelKey } from "@/lib/canvas/canvas-video-volcengine";

/** 火山方舟 Seedance 多图参考成片 */
export const STORYBOARD_VOLCENGINE_VIDEO_MODELS = [
  "doubao-seedance-2.0",
  "doubao-seedance-1.5-pro",
] as const;

/** KIE 多图参考成片（Seedance 等；可灵 3.0 已迁百炼） */
export const STORYBOARD_KIE_VIDEO_MODELS = ["bytedance/seedance-2"] as const;

/** 百炼 DashScope · 可灵 3.0 图/文生视频 */
export const STORYBOARD_KLING30_VIDEO_MODELS = [
  "kling-3.0/video",
  "kling-3.0",
] as const;

/** 百炼 DashScope 参考生视频（1～9 张 reference_image） */
export const STORYBOARD_BAILIAN_R2V_VIDEO_MODELS = BAILIAN_R2V_MODEL_IDS;

/** 万相 3.0 All-in-One（DashScope · 文生/图生/参考生） */
export const STORYBOARD_WAN30_VIDEO_MODELS = [
  "wan3.0-video",
  "wan3.0-video-prime",
] as const;

export function isStoryboardWan30VideoModel(modelKey: string): boolean {
  return (STORYBOARD_WAN30_VIDEO_MODELS as readonly string[]).includes(
    modelKey.trim(),
  );
}

export function isStoryboardKling30VideoModel(modelKey: string): boolean {
  return isDashscopeKlingV3VideoGatewayModel(modelKey);
}

/** @deprecated 使用 isStoryboardKling30VideoModel */
export function isStoryboardKling30KieVideoModel(modelKey: string): boolean {
  return isStoryboardKling30VideoModel(modelKey);
}

/** MiniMax H3 直连 */
export const STORYBOARD_MINIMAX_VIDEO_MODELS = [
  "MiniMax/MiniMax-H3-t2v",
  "MiniMax/MiniMax-H3-i2v",
  "MiniMax/MiniMax-H3-fl2v",
  "MiniMax/MiniMax-H3-r2v",
  "MiniMax/MiniMax-H3-s2v",
  "MiniMax/MiniMax-H3-regeneration",
] as const;

export const STORYBOARD_VIDEO_MODELS = [
  ...STORYBOARD_VOLCENGINE_VIDEO_MODELS,
  ...STORYBOARD_KIE_VIDEO_MODELS,
  ...STORYBOARD_KLING30_VIDEO_MODELS,
  ...STORYBOARD_BAILIAN_R2V_VIDEO_MODELS,
  ...STORYBOARD_WAN30_VIDEO_MODELS,
  ...STORYBOARD_MINIMAX_VIDEO_MODELS,
] as const;

export function isStoryboardKieVideoModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  if (isStoryboardKling30VideoModel(modelKey)) return false;
  return (
    k === "bytedance/seedance-2" ||
    k.includes("bytedance/seedance")
  );
}

export function resolveStoryboardKieVideoUpstreamModel(modelKey: string): string {
  return "bytedance/seedance-2";
}

export function isStoryboardVolcengineVideoModel(modelKey: string): boolean {
  return isVolcengineStoryVideoModelKey(modelKey);
}

export function isStoryboardBailianR2vVideoModel(modelKey: string): boolean {
  const k = modelKey.trim();
  return (
    (STORYBOARD_BAILIAN_R2V_VIDEO_MODELS as readonly string[]).includes(k) ||
    (BAILIAN_R2V_MODEL_IDS as readonly string[]).includes(k)
  );
}

export function isStoryboardMinimaxVideoModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (STORYBOARD_MINIMAX_VIDEO_MODELS as readonly string[]).some(
    (m) => m.toLowerCase() === k,
  );
}

export function resolveStoryboardVideoProvider(
  modelKey: string,
): "volcengine" | "kie" | "bailian" | "minimax" | "dashscope" {
  if (isStoryboardWan30VideoModel(modelKey)) return "dashscope";
  if (isStoryboardKling30VideoModel(modelKey)) return "dashscope";
  if (isStoryboardKieVideoModel(modelKey)) return "kie";
  if (isStoryboardBailianR2vVideoModel(modelKey)) return "bailian";
  if (isStoryboardMinimaxVideoModel(modelKey)) return "minimax";
  return "volcengine";
}

/**
 * 电商分镜 / 种草 / 拆图复刻：带参考图时，HappyHorse / Wan 的 T2V·I2V 须升 R2V。
 * 禁止静默落到 doubao-seedance（会误走火山凭证）。
 */
export function normalizeEcomStoryboardVideoModelKey(modelKey: string): string {
  const k = modelKey.trim();
  if (!k) return "";
  const fromT2v = dashscopeSbv1T2vModelToR2v(k);
  if (fromT2v) return fromT2v;
  if (isDashscopeHappyhorseImageToVideoModel(k)) {
    return k.replace(/-i2v$/i, "-r2v");
  }
  return k;
}

export function resolveStoryboardVideoModel(modelKey?: string): string {
  const raw = modelKey?.trim() ?? "";
  const k = normalizeEcomStoryboardVideoModelKey(raw);
  if (!k) {
    throw new Error("请选择视频模型");
  }
  if ((STORYBOARD_VIDEO_MODELS as readonly string[]).includes(k)) return k;
  if (isStoryboardWan30VideoModel(k)) return k;
  if (isStoryboardKling30VideoModel(k)) return "kling-3.0/video";
  if (isStoryboardKieVideoModel(k)) return "bytedance/seedance-2";
  if (isStoryboardBailianR2vVideoModel(k)) return k;
  throw new Error(
    `视频模型「${raw}」暂不支持电商分镜成片；请在模型列表中选择已绑定的 R2V（如 happyhorse-1.1-r2v、wan2.7-r2v）或 Seedance / Wan 3.0。`,
  );
}
