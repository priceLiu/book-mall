import { normalizeOutfitProductionMentionFields } from "@/lib/ecom/ecom-outfit-production-mentions";
import type {
  OutfitProduction,
  OutfitStoryboardAdapt,
  SceneShot,
  WorkflowRefs,
} from "@/lib/ecom/video-workflow/shot-spine";
import type { OutfitProductionMeta } from "@/lib/ecom/ecom-outfit-video-types";

function pickProductionTextField(
  adapted: string | undefined,
  splitFallback: string | undefined,
): string | undefined {
  const a = adapted?.trim();
  if (a) return a;
  const s = splitFallback?.trim();
  return s || undefined;
}

export function buildOutfitProductionFromAdapt(
  scene: SceneShot,
  adapt: OutfitStoryboardAdapt,
): OutfitProduction {
  const ok = adapt.status === "success";
  const mentions = normalizeOutfitProductionMentionFields({
    cameraMove: pickProductionTextField(adapt.cameraMove, scene.cameraMove),
    characterAction: pickProductionTextField(adapt.characterAction, scene.characterAction),
    sceneBackground: pickProductionTextField(adapt.sceneBackground, scene.sceneBackground),
    finalStoryboard: adapt.finalStoryboard,
    positivePrompt: adapt.positivePrompt,
  });
  return {
    status: ok ? "success" : "failed",
    failReason: adapt.failReason,
    cameraMove: mentions.cameraMove,
    characterAction: mentions.characterAction,
    lightingSetup: pickProductionTextField(adapt.lightingSetup, scene.lightingSetup),
    sceneBackground: mentions.sceneBackground,
    finalStoryboard: mentions.finalStoryboard,
    positivePrompt: mentions.positivePrompt,
    negativePrompt: adapt.negativePrompt,
    adjustLogic: adapt.adjustLogic,
    mode: adapt.mode,
    generatedAt: adapt.adaptedAt ?? new Date().toISOString(),
    splitModelKey: adapt.splitModelKey,
  };
}

/** 融图 / 生成 Prompt 使用制作表字段覆盖拆解字段 */
export function sceneWithOutfitProductionOverlay(scene: SceneShot): SceneShot {
  const p = scene.outfitProduction;
  if (!p || p.status !== "success") return scene;
  return {
    ...scene,
    cameraMove: p.cameraMove?.trim() || scene.cameraMove,
    characterAction: p.characterAction?.trim() || scene.characterAction,
    lightingSetup: p.lightingSetup?.trim() || scene.lightingSetup,
    sceneBackground: p.sceneBackground?.trim() || scene.sceneBackground,
  };
}

export function applyDefaultSceneFusionToShot(
  scene: SceneShot,
  refs: WorkflowRefs,
): SceneShot {
  const preset = refs.sceneLibraryPreset;
  const globalRefUrl = refs.sceneRef?.ossUrl?.trim();

  if (preset?.entryId?.trim()) {
    return {
      ...scene,
      sceneFusion: {
        mode: "library",
        libraryEntryId: preset.entryId,
        libraryEntryName: preset.entryName,
        visualPromptFragment: preset.visualPromptFragment,
      },
    };
  }

  if (globalRefUrl) {
    return {
      ...scene,
      sceneFusion: {
        mode: "upload_ref",
        sceneRefUrl: globalRefUrl,
      },
    };
  }

  return {
    ...scene,
    sceneFusion: { mode: "follow_reference" },
  };
}

export function readOutfitProductionMeta(
  meta: Record<string, unknown> | null | undefined,
): OutfitProductionMeta | null {
  const raw = meta?.outfitProductionMeta;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== "none" &&
    status !== "generating" &&
    status !== "ready" &&
    status !== "stale" &&
    status !== "partial_failed" &&
    status !== "failed"
  ) {
    return null;
  }
  return {
    status,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : undefined,
    failCount: typeof o.failCount === "number" ? o.failCount : undefined,
    splitModelKey: typeof o.splitModelKey === "string" ? o.splitModelKey : undefined,
  };
}

export function isOutfitProductionReady(meta: Record<string, unknown> | null | undefined): boolean {
  const m = readOutfitProductionMeta(meta);
  return m?.status === "ready" || m?.status === "partial_failed";
}

export function outfitProductionReadyFromScenes(scenes: SceneShot[]): boolean {
  return scenes.some((s) => s.outfitProduction?.status === "success");
}

export function clearOutfitProductionFromScenes(scenes: SceneShot[]): SceneShot[] {
  return scenes.map(({ outfitProduction: _p, outfitStoryboardAdapt: _a, userGeneratePrompt: _u, ...rest }) => ({
    ...rest,
    sceneFusion: rest.sceneFusion
      ? {
          ...rest.sceneFusion,
          fusedImageUrl: undefined,
          status: undefined,
          failReason: undefined,
          sharedFromShotIndex: undefined,
        }
      : undefined,
  }));
}
