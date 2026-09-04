import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";

/** 融图固定主体模板（文档 §场景与模特融合） */
export const OUTFIT_SCENE_FUSION_SUBJECT_PROMPT_ZH = [
  "商业电商人像摄影，9:16竖版，高清8K，真实相机拍摄。",
  "模特保持正面站立全身人像，严格保留原模特五官脸型、发型、服装款式、面料与印花细节，不要改变人物样貌。",
  "将人物自然放置到参考场景当中，适配场景的环境光线，生成自然真实的地面投影，人物和环境光影融合自然，画面干净高级。",
].join("");

export const OUTFIT_SCENE_FUSION_NEGATIVE_PROMPT_ZH =
  "人脸变形，五官错位，脸部扭曲，修改服装款式，服装印花丢失，肢体畸形，手部崩坏，身体扭转侧对镜头，背影，卡通，手绘，绘画，水印，文字，模糊，多余肢体";

export function buildOutfitSceneFusionPositivePrompt(sceneFragment: string): string {
  const fragment = sceneFragment.trim();
  if (!fragment) return OUTFIT_SCENE_FUSION_SUBJECT_PROMPT_ZH;
  return `${OUTFIT_SCENE_FUSION_SUBJECT_PROMPT_ZH}${fragment}`;
}

/** 跟随原视频：从拆镜 enrich 拼接场景片段 */
export function buildOutfitFollowReferenceSceneFragment(scene: SceneShot): string {
  const background = scene.sceneBackground?.trim();
  const lighting = scene.lightingSetup?.trim();
  const parts = [background, lighting].filter(Boolean);
  return parts.join("，");
}

export const OUTFIT_SCENE_FUSION_FOLLOW_REFERENCE_LABEL = "跟随原视频场景";
