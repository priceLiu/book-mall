import { formatProductInteractionLabel } from "@/lib/storyboard-deliverable-labels";
import type { FilmPullProductionShot } from "@/lib/film-pull-types";

export function formatFilmPullShotTimeline(shot: FilmPullProductionShot): string {
  return `${shot.startTimeSec.toFixed(1)}–${shot.endTimeSec.toFixed(1)}s`;
}

export function formatFilmPullShotCamera(shot: FilmPullProductionShot): string {
  const parts = [shot.cameraMovement, shot.cameraAngle].filter((v) => v && v !== "无");
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function formatFilmPullConfirmCell(value: string | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "无" ? trimmed : fallback;
}

export function formatFilmPullProductInteraction(shot: FilmPullProductionShot): string {
  return formatProductInteractionLabel(shot.productInteraction ?? "none");
}

export const FILM_PULL_PRODUCT_INTERACTION_OPTIONS = [
  { value: "none", label: "无" },
  { value: "hold", label: "手持" },
  { value: "wear", label: "穿戴" },
  { value: "use", label: "使用" },
  { value: "apply", label: "涂抹" },
  { value: "display", label: "展示" },
  { value: "unbox", label: "开箱" },
] as const;

/** 将制作镜映射为故事版 PanelCard 所需最小字段 */
export function filmPullShotToStoryboardPanel(shot: FilmPullProductionShot) {
  return {
    index: shot.shotNo,
    timeline: formatFilmPullShotTimeline(shot),
    shotType: shot.shotScale,
    scene: shot.sceneEnvironment,
    scenePrompt: shot.aiVisualPrompt,
    action: shot.subjectBlocking,
    dialogue: shot.audioInfo.scriptSubtitle,
    camera: formatFilmPullShotCamera(shot),
    emotion: shot.audioInfo.vocalEmotion,
    imageUrl: shot.imageUrl ?? undefined,
    videoUrl: shot.videoUrl ?? undefined,
    imagePrompt: shot.imagePrompt,
    productInteraction: shot.productInteraction ?? "none",
  };
}
