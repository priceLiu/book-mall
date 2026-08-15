/**
 * 电商工具箱 · 模型卡片「参考图最多 N 张」（与 book-mall 调入规则对齐，前端展示用）
 */

import { getImageGenMaxRefsClient } from "@/lib/product-design-ref-rules";
import {
  isStoryboardKling30KieVideoModel,
  resolveStoryboardBailianR2vMaxRefImages,
} from "@/lib/storyboard-video-params";
import { inferStoryboardVideoCapabilities } from "@/lib/storyboard-video-model-type";

/** 生图模型 · 送入模型的参考图总上限 */
export function resolveStoryboardImageMaxRefImages(modelKey: string): number {
  return getImageGenMaxRefsClient(modelKey);
}

/** 视频模型 · 参考图总上限；纯文生视频返回 0 */
export function resolveStoryboardVideoMaxRefImages(modelKey: string): number {
  const k = modelKey.trim();
  const bailianMax = resolveStoryboardBailianR2vMaxRefImages(k);
  if (bailianMax != null) return bailianMax;

  const caps = inferStoryboardVideoCapabilities(k);
  const needsRefs = caps.some(
    (c) =>
      c === "video_i2v" ||
      c === "video_r2v" ||
      c === "video_multi_ref" ||
      c === "video_v2v",
  );
  if (!needsRefs) return 0;

  if (/doubao-seedance|seedance-2|bytedance\/seedance/i.test(k)) {
    if (/volcengine|doubao-seedance/i.test(k)) return 9;
    return 8;
  }

  if (isStoryboardKling30KieVideoModel(k)) return 4;
  if (/kling.*image-to-video|kling\/v3-turbo-image/i.test(k)) return 2;
  if (k === "wan/2-7-image-to-video") return 1;

  if (/happyhorse.*-i2v|happyhorse\/image-to-video/i.test(k)) return 1;
  if (/grok-imagine.*image-to-video/i.test(k)) return 1;

  return 1;
}

export function resolveStoryboardModelMaxRefImages(
  modelKey: string,
  mode: "image" | "video",
): number {
  return mode === "image"
    ? resolveStoryboardImageMaxRefImages(modelKey)
    : resolveStoryboardVideoMaxRefImages(modelKey);
}

/** 卡片脚注：参考图上限文案 */
export function formatStoryboardModelRefCountLabel(
  modelKey: string,
  mode: "image" | "video",
): string {
  const max = resolveStoryboardModelMaxRefImages(modelKey, mode);
  if (mode === "video" && max === 0) return "无需参考图";
  return `参考图最多 ${max} 张`;
}
