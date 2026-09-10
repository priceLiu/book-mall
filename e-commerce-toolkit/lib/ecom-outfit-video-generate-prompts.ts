import type { SceneShot } from "@/lib/video-workflow/shot-spine";
import { OUTFIT_SPLIT_MANUAL_EDIT_HINT } from "@/lib/outfit-video-split-enrich-validate";

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

/** §十 §四：预填正向 Prompt（不含运镜/动作） */
export function buildOutfitShotPrefilledGeneratePrompt(scene: SceneShot): string {
  const parts = [OUTFIT_V1_GENERATE_BASE_PROMPT_ZH];
  if (scene.parseIncomplete) {
    return parts.join("，");
  }
  if (scene.lightingSetup?.trim() && !isManualEditPlaceholder(scene.lightingSetup)) {
    parts.push(scene.lightingSetup.trim());
  }
  if (scene.sceneBackground?.trim() && !isManualEditPlaceholder(scene.sceneBackground)) {
    parts.push(scene.sceneBackground.trim());
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
  if (scene.userGeneratePrompt !== undefined && scene.userGeneratePrompt !== null) {
    return scene.userGeneratePrompt.trim();
  }
  const adapted = scene.outfitStoryboardAdapt;
  if (adapted?.status === "success" && adapted.positivePrompt?.trim()) {
    return adapted.positivePrompt.trim();
  }
  return buildOutfitShotPrefilledGeneratePrompt(scene);
}

/** 负向：优先分镜适配结果，否则全局默认 */
export function resolveOutfitShotNegativePrompt(scene: SceneShot): string {
  const adapted = scene.outfitStoryboardAdapt?.negativePrompt?.trim();
  if (adapted) return adapted;
  return OUTFIT_V1_NEGATIVE_PROMPT_ZH;
}

/** 当前 UI 展示用正向 Prompt（未持久化时按预填 / 适配规则） */
export function outfitShotDisplayGeneratePrompt(scene: SceneShot): string {
  if (scene.userGeneratePrompt !== undefined && scene.userGeneratePrompt !== null) {
    return scene.userGeneratePrompt;
  }
  return resolveOutfitShotGeneratePrompt(scene);
}
