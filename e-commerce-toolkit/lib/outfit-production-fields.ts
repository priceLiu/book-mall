import type { OutfitProductionMeta } from "@/lib/ecom-outfit-video-api";
import {
  isOutfitProductionMentionFieldName,
  normalizeOutfitProductionMentionFields,
} from "@/lib/outfit-production-mentions";
import type { OutfitProduction, SceneShot } from "@/lib/video-workflow/shot-spine";

export type OutfitProductionTextField =
  | "cameraMove"
  | "characterAction"
  | "lightingSetup"
  | "sceneBackground"
  | "positivePrompt"
  | "negativePrompt"
  | "finalStoryboard"
  | "adjustLogic";

export function parseOutfitProductionMeta(
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

export function isOutfitProductionTableReady(
  meta: Record<string, unknown> | null | undefined,
  scenes: SceneShot[],
): boolean {
  const m = parseOutfitProductionMeta(meta);
  if (m?.status === "ready" || m?.status === "partial_failed") return true;
  return scenes.some((s) => s.outfitProduction?.status === "success");
}

export function getOutfitProductionField(
  shot: SceneShot,
  field: OutfitProductionTextField,
): string {
  const p = shot.outfitProduction;
  if (p?.status === "success" || p?.status === "failed" || p?.status === "generating") {
    const v = p[field];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  switch (field) {
    case "cameraMove":
      return shot.cameraMove?.trim() ?? "";
    case "characterAction":
      return shot.characterAction?.trim() ?? "";
    case "lightingSetup":
      return shot.lightingSetup?.trim() ?? "";
    case "sceneBackground":
      return shot.sceneBackground?.trim() ?? "";
    default:
      return "";
  }
}

export function patchOutfitProductionField(
  shot: SceneShot,
  field: OutfitProductionTextField,
  value: string,
): SceneShot {
  let nextValue = value;
  if (isOutfitProductionMentionFieldName(field)) {
    nextValue =
      normalizeOutfitProductionMentionFields({ [field]: value })[field] ?? value;
  }
  const production: OutfitProduction = {
    ...(shot.outfitProduction ?? { status: "success" }),
    status: shot.outfitProduction?.status === "success" ? "success" : "success",
    [field]: nextValue,
  };
  return { ...shot, outfitProduction: production };
}

export function sceneWithProductionOverlay(shot: SceneShot): SceneShot {
  const p = shot.outfitProduction;
  if (!p || p.status !== "success") return shot;
  return {
    ...shot,
    cameraMove: p.cameraMove?.trim() || shot.cameraMove,
    characterAction: p.characterAction?.trim() || shot.characterAction,
    lightingSetup: p.lightingSetup?.trim() || shot.lightingSetup,
    sceneBackground: p.sceneBackground?.trim() || shot.sceneBackground,
  };
}
