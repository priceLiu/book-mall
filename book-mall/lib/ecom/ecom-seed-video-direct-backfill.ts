import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC,
  ECOM_SEED_VIDEO_MODULE,
  parseSeedVideoPlan,
  type SeedVideoDirectGeneratedVideo,
  type SeedVideoDirectPlan,
  type SeedVideoPlan,
} from "@/lib/ecom/ecom-seed-video-types";

function readAssetProjectId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const projectId = (meta as Record<string, unknown>).projectId;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
}

function readAssetKind(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const kind = (meta as Record<string, unknown>).kind;
  return typeof kind === "string" ? kind : null;
}

function readAssetTaskId(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const taskId = (meta as Record<string, unknown>).taskId;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : undefined;
}

function appendDirectGeneratedVideo(
  prev: SeedVideoDirectPlan | undefined,
  entry: SeedVideoDirectGeneratedVideo,
): SeedVideoDirectGeneratedVideo[] {
  const out: SeedVideoDirectGeneratedVideo[] = [...(prev?.generatedVideos ?? [])];
  const legacyUrl = prev?.videoUrl?.trim();
  if (legacyUrl && !out.some((v) => v.videoUrl === legacyUrl)) {
    out.push({
      id: prev?.taskId?.trim() || entry.id,
      videoUrl: legacyUrl,
      taskId: prev?.taskId,
    });
  }
  if (!out.some((v) => v.videoUrl === entry.videoUrl)) {
    out.push(entry);
  }
  return out;
}

/** 从 EcomAsset / videoAssetId 回填 plan.directVideo（Gateway 已成功但 plan 被 autosave 覆盖时） */
export async function backfillSeedVideoDirectVideoFromAssets(opts: {
  userId: string;
  projectId: string;
  plan: SeedVideoPlan | null;
  videoAssetId?: string | null;
  persist?: boolean;
}): Promise<{ plan: SeedVideoPlan | null; changed: boolean }> {
  const prevPlan = opts.plan ?? {};
  const prevDirect = prevPlan.directVideo;
  const hasList =
    (prevDirect?.generatedVideos?.some((v) => v.videoUrl?.trim()) ?? false) ||
    Boolean(prevDirect?.videoUrl?.trim());
  if (hasList) return { plan: opts.plan, changed: false };

  let ossUrl: string | null = null;
  let taskId: string | undefined;
  let modelKey: string | undefined;
  let assetId: string | undefined;

  if (opts.videoAssetId?.trim()) {
    const asset = await prisma.ecomAsset.findFirst({
      where: { userId: opts.userId, id: opts.videoAssetId.trim() },
      select: { id: true, ossUrl: true, meta: true },
    });
    if (asset?.ossUrl?.trim()) {
      ossUrl = asset.ossUrl.trim();
      assetId = asset.id;
      taskId = readAssetTaskId(asset.meta);
    }
  }

  if (!ossUrl) {
    const assets = await prisma.ecomAsset.findMany({
      where: { userId: opts.userId, module: ECOM_SEED_VIDEO_MODULE, kind: "video" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, ossUrl: true, meta: true, createdAt: true },
    });
    for (const asset of assets) {
      if (readAssetProjectId(asset.meta) !== opts.projectId) continue;
      if (readAssetKind(asset.meta) !== "direct_video") continue;
      const url = asset.ossUrl?.trim();
      if (!url || !/^https?:\/\//.test(url)) continue;
      ossUrl = url;
      assetId = asset.id;
      taskId = readAssetTaskId(asset.meta);
      const mk = (asset.meta as Record<string, unknown> | null)?.modelKey;
      modelKey = typeof mk === "string" ? mk : undefined;
      break;
    }
  }

  if (!ossUrl) return { plan: opts.plan, changed: false };

  const generatedVideos = appendDirectGeneratedVideo(prevDirect, {
    id: taskId ?? assetId ?? ossUrl,
    videoUrl: ossUrl,
    taskId,
    modelKey,
    createdAt: new Date().toISOString(),
  });

  const nextDirect: SeedVideoDirectPlan = {
    globalPrompt: prevDirect?.globalPrompt ?? "",
    fullVoiceover: prevDirect?.fullVoiceover ?? "",
    aspectRatio: prevDirect?.aspectRatio ?? "9:16",
    durationSec: prevDirect?.durationSec ?? ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC,
    bgmPreset: prevDirect?.bgmPreset,
    voiceTone: prevDirect?.voiceTone,
    materialUsage: prevDirect?.materialUsage,
    shotSequence: prevDirect?.shotSequence,
    generatedVideos,
    taskId: taskId ?? prevDirect?.taskId,
    videoUrl: ossUrl,
  };

  const nextPlan: SeedVideoPlan = {
    ...prevPlan,
    directVideo: nextDirect,
    render: prevPlan.render?.finalVideoUrl
      ? prevPlan.render
      : { finalVideoUrl: ossUrl, assetId },
  };

  if (opts.persist !== false) {
    const row = await prisma.ecomSeedVideoProject.findFirst({
      where: { id: opts.projectId, userId: opts.userId },
      select: { plan: true, videoAssetId: true },
    });
    const dbPlan = parseSeedVideoPlan(row?.plan) ?? prevPlan;
    await prisma.ecomSeedVideoProject.update({
      where: { id: opts.projectId },
      data: {
        plan: {
          ...dbPlan,
          directVideo: mergeSeedVideoDirectPlanPreserveMedia(nextDirect, dbPlan.directVideo),
          render: dbPlan.render?.finalVideoUrl
            ? dbPlan.render
            : { finalVideoUrl: ossUrl, assetId },
        } as Prisma.InputJsonValue,
        ...(row?.videoAssetId ? {} : { videoAssetId: assetId ?? undefined }),
      },
    });
  }

  return { plan: nextPlan, changed: true };
}

export function mergeSeedVideoDirectPlanPreserveMedia(
  incoming: Partial<SeedVideoDirectPlan>,
  previous?: SeedVideoDirectPlan | null,
): SeedVideoDirectPlan {
  const prev = previous ?? ({} as SeedVideoDirectPlan);
  return {
    ...prev,
    ...incoming,
    globalPrompt: incoming.globalPrompt ?? prev.globalPrompt ?? "",
    fullVoiceover: incoming.fullVoiceover ?? prev.fullVoiceover ?? "",
    videoUrl: incoming.videoUrl?.trim() || prev.videoUrl,
    taskId: incoming.taskId?.trim() || prev.taskId,
    generatedVideos:
      incoming.generatedVideos && incoming.generatedVideos.length > 0
        ? incoming.generatedVideos
        : prev.generatedVideos,
  };
}
