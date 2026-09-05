import type { SceneShot } from "@/lib/video-workflow/shot-spine";
import { buildOutfitShotPrefilledGeneratePrompt } from "@/lib/ecom-outfit-video-generate-prompts";

export type OutfitShotAnalysis = {
  characterAction: string;
  cameraMove: string;
  lightingSetup: string;
  sceneBackground: string;
  toneContrast?: string;
  parseIncomplete?: boolean;
};

export function applyOutfitShotAnalysisToScene(
  scene: SceneShot,
  analysis: OutfitShotAnalysis,
): SceneShot {
  const next: SceneShot = {
    ...scene,
    characterAction: analysis.characterAction.trim(),
    cameraMove: analysis.cameraMove.trim(),
    lightingSetup: analysis.lightingSetup.trim(),
    sceneBackground: analysis.sceneBackground.trim(),
    toneContrast: analysis.toneContrast?.trim() || undefined,
    parseIncomplete: analysis.parseIncomplete ?? false,
  };
  return {
    ...next,
    userGeneratePrompt: buildOutfitShotPrefilledGeneratePrompt(next),
  };
}

export function outfitSceneCameraLabel(scene: SceneShot): string {
  return scene.cameraMove?.trim() || scene.cameraType?.trim() || "—";
}

export function outfitSceneActionLabel(scene: SceneShot): string {
  return scene.characterAction?.trim() || scene.motionType?.trim() || "—";
}

export function outfitSceneLightingLabel(scene: SceneShot): string {
  return scene.lightingSetup?.trim() || "—";
}

export function outfitSceneBackgroundLabel(scene: SceneShot): string {
  return scene.sceneBackground?.trim() || "—";
}

export {
  DEFAULT_OUTFIT_SPLIT_USER_PROMPT,
  OUTFIT_SPLIT_FENCE,
  OUTFIT_SPLIT_JSON_DELIVERY_FOOTER,
  OUTFIT_SPLIT_V10_SYSTEM_PROMPT,
  getOutfitSplitEnrichPromptUi,
  outfitSplitUserPromptPreview,
} from "@/lib/outfit-video-split-prompts";
