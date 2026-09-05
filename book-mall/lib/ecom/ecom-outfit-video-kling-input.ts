/** Kling motion-control 仅 1 张 input_urls · 穿搭路由与 Prompt 补强 */

import {
  isOutfitVideoKlingMotionControlModel,
  resolveOutfitVideoGenerateModelKey,
  resolveOutfitVideoGenerateProvider,
} from "@/lib/ecom/ecom-outfit-video-models";

export const OUTFIT_DUAL_REF_R2V_FALLBACK_MODEL = "wan2.7-r2v";

export function hasOutfitDualRefInputs(modelUrl: string, clothingUrl: string): boolean {
  const model = modelUrl.trim();
  const clothing = clothingUrl.trim();
  return Boolean(model && clothing && model !== clothing);
}

/**
 * 模特 + 服装为两张独立参考图时，Kling 单图无法同时迁移身份与服装，
 * 自动改走百炼 R2V（可多图 + 参考片段关键帧）。
 */
export function shouldOutfitUseDualRefR2vFallback(
  videoModelKey: string,
  body: { modelImageUrl: string; clothingImageUrl: string },
): boolean {
  const resolved = resolveOutfitVideoGenerateModelKey(videoModelKey);
  if (!isOutfitVideoKlingMotionControlModel(resolved)) return false;
  return hasOutfitDualRefInputs(body.modelImageUrl, body.clothingImageUrl);
}

export type OutfitShotGenerateRoute =
  | { kind: "kling"; modelKey: string }
  | { kind: "bailian-r2v"; modelKey: string; autoFallbackFromKling?: boolean }
  | { kind: "wan-v2v"; modelKey: string };

export function resolveOutfitShotGenerateRoute(
  videoModelKey: string,
  body: { modelImageUrl: string; clothingImageUrl: string },
): OutfitShotGenerateRoute {
  const resolved = resolveOutfitVideoGenerateModelKey(videoModelKey);

  if (shouldOutfitUseDualRefR2vFallback(resolved, body)) {
    return {
      kind: "bailian-r2v",
      modelKey: OUTFIT_DUAL_REF_R2V_FALLBACK_MODEL,
      autoFallbackFromKling: true,
    };
  }

  if (isOutfitVideoKlingMotionControlModel(resolved)) {
    return { kind: "kling", modelKey: resolved };
  }

  if (resolved === "wan/2-6-video-to-video") {
    return { kind: "wan-v2v", modelKey: resolved };
  }

  if (resolveOutfitVideoGenerateProvider(resolved) === "bailian") {
    return { kind: "bailian-r2v", modelKey: resolved };
  }

  throw new Error(`视频模型「${resolved}」尚未接入穿搭逐镜生成`);
}

export function isLikelyOutfitPortraitModelUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  return (
    /model-library/.test(u) ||
    /\/female-\d+/.test(u) ||
    /\/male-\d+/.test(u) ||
    /portrait|headshot|avatar|证件|半身/.test(u)
  );
}

/** Kling 入参：产品规格仅传模特参考图（单图） */
export function resolveOutfitKlingMotionControlInputImage(modelUrl: string): string {
  const model = modelUrl.trim();
  if (!model) throw new Error("缺少模特参考图，无法调用 Kling 动作控制");
  return model;
}

export function enrichOutfitKlingMotionControlPrompt(
  basePrompt: string,
  opts: { hasSeparateClothingRef: boolean },
): string {
  const parts = [basePrompt.trim()];
  parts.push("全身出镜，画面稳定流畅，真实电商面料质感");
  if (opts.hasSeparateClothingRef) {
    parts.push("严格穿着已锁定的服装款式与颜色");
  }
  return parts.filter(Boolean).join("，");
}
