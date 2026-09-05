import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL,
  ECOM_FILM_PULL_TOOL_KEY,
} from "@/lib/ecom/ecom-film-pull-types";
import { resolveProductionShotRefUrls } from "@/lib/ecom/ecom-film-pull-ref-match";
import {
  getEcomFilmPullProject,
  patchFilmPullProductionShot,
  updateEcomFilmPullProject,
} from "@/lib/ecom/ecom-film-pull-service";
import { clampFilmPullDurationSec } from "@/lib/ecom/ecom-film-pull-enums";

export async function ecomGenerateFilmPullProductionImage(opts: {
  userId: string;
  projectId: string;
  shotNo: number;
  modelKey: string;
  imageSize?: string;
}): Promise<{ shotNo: number; imageUrl: string }> {
  const project = await getEcomFilmPullProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!project.meta?.productionScriptConfirmedAt) {
    throw new Error("请先确认制作脚本");
  }
  const shot = project.productionPlan?.shots.find((s) => s.shotNo === opts.shotNo);
  if (!shot) throw new Error(`镜头 ${opts.shotNo} 不存在`);

  const prompt = shot.imagePrompt.trim();
  if (!prompt) throw new Error(`镜头 ${opts.shotNo} 缺少生图 Prompt`);

  const refUrls = resolveProductionShotRefUrls(project.characterRefs, shot, project.refMatch);

  const aspectRatio = project.settings.aspectRatio ?? "9:16";
  const ratio: EcomImageRatio = aspectRatio === "16:9" ? "16:9" : "4:5";

  await updateEcomFilmPullProject(opts.userId, opts.projectId, { status: "generating_shots" });

  const imageUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey: opts.modelKey,
    prompt,
    ratio,
    imageSize: opts.imageSize,
    refImageUrls: refUrls,
    toolKey: `${ECOM_FILM_PULL_TOOL_KEY}__production-image`,
  });

  await patchFilmPullProductionShot(opts.userId, opts.projectId, opts.shotNo, {
    imageUrl,
    status: shot.videoUrl ? "ready" : "pending_video",
  });

  return { shotNo: opts.shotNo, imageUrl };
}

export function resolveFilmPullActivePlan(project: NonNullable<Awaited<ReturnType<typeof getEcomFilmPullProject>>>) {
  if (project.productionPlan?.shots.length && project.meta?.productionScriptConfirmedAt) {
    return { kind: "production" as const, plan: project.productionPlan };
  }
  if (project.renderPlan?.shots.length) {
    return { kind: "legacy" as const, plan: project.renderPlan };
  }
  return null;
}

export function productionShotDurationSec(shot: { durationSec: number }): number {
  return clampFilmPullDurationSec(shot.durationSec, 5);
}
