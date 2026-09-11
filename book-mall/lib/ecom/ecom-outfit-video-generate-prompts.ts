import { stripOutfitVideoMentionTokensForVideoApi } from "@/lib/ecom/ecom-outfit-video-mention-refs";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";
import { OUTFIT_SPLIT_MANUAL_EDIT_HINT } from "@/lib/ecom/ecom-outfit-video-split-enrich-validate";

/** §十 · 逐镜生成基础画质（正向预填固定前缀） */
export const OUTFIT_V1_GENERATE_BASE_PROMPT_ZH =
  "9:16竖屏，商业电商穿搭短视频，高清画质，真实服装面料，画面稳定流畅";

/** §十 · 负向 Prompt（UI 只读；Kling motion-control 可不传 API） */
export const OUTFIT_V1_NEGATIVE_PROMPT_ZH =
  "肢体畸形，身体扭曲，人脸漂移闪烁，服装褶皱错乱，画面闪烁抖动，图像模糊，曝光异常，多余肢体，卡通动漫画风";

function isManualEditPlaceholder(text: string | undefined): boolean {
  const t = text?.trim() ?? "";
  return t === OUTFIT_SPLIT_MANUAL_EDIT_HINT || t.startsWith("【AI识别不足");
}

function resolveProductionOrSplitField(
  scene: SceneShot,
  field: "lightingSetup" | "sceneBackground",
): string | undefined {
  const production = scene.outfitProduction;
  if (production?.status === "success") {
    const fromProduction = production[field]?.trim();
    if (fromProduction) return fromProduction;
  }
  return scene[field]?.trim();
}

/** §十 §四：预填正向 Prompt（不含运镜/动作） */
export function buildOutfitShotPrefilledGeneratePrompt(scene: SceneShot): string {
  const parts = [OUTFIT_V1_GENERATE_BASE_PROMPT_ZH];
  if (scene.parseIncomplete) {
    return parts.join("，");
  }
  const lighting = resolveProductionOrSplitField(scene, "lightingSetup");
  const background = resolveProductionOrSplitField(scene, "sceneBackground");
  if (lighting && !isManualEditPlaceholder(lighting)) {
    parts.push(lighting);
  }
  if (background && !isManualEditPlaceholder(background)) {
    parts.push(background);
  }
  return parts.join("，");
}

/**
 * 解析提交给视频模型的正向 Prompt：
 * - 用户曾编辑（含清空为 ""）→ 用 userGeneratePrompt
 * - 否则若分镜适配成功 → 用 positivePrompt
 * - 否则 → 系统预填
 */
export function resolveOutfitShotGeneratePrompt(scene: SceneShot): string {
  let prompt: string;
  if (scene.userGeneratePrompt !== undefined && scene.userGeneratePrompt !== null) {
    prompt = scene.userGeneratePrompt.trim();
  } else {
    const production = scene.outfitProduction;
    if (production?.status === "success" && production.positivePrompt?.trim()) {
      prompt = production.positivePrompt.trim();
    } else {
      const adapted = scene.outfitStoryboardAdapt;
      if (adapted?.status === "success" && adapted.positivePrompt?.trim()) {
        prompt = adapted.positivePrompt.trim();
      } else {
        prompt = buildOutfitShotPrefilledGeneratePrompt(scene);
      }
    }
  }
  return stripOutfitVideoMentionTokensForVideoApi(prompt);
}

/** 负向：优先制作表，其次分镜适配结果，否则全局默认 */
export function resolveOutfitShotNegativePrompt(scene: SceneShot): string {
  const fromProduction = scene.outfitProduction?.negativePrompt?.trim();
  if (fromProduction) return fromProduction;
  const adapted = scene.outfitStoryboardAdapt?.negativePrompt?.trim();
  if (adapted) return adapted;
  return OUTFIT_V1_NEGATIVE_PROMPT_ZH;
}
