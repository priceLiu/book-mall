import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ECOM_SEED_VIDEO_MODULE,
  parseSeedVideoPlan,
  type SeedVideoPlan,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";

function readAssetShotIndex(meta: unknown): number | null {
  if (!meta || typeof meta !== "object") return null;
  const shotIndex = (meta as Record<string, unknown>).shotIndex;
  return typeof shotIndex === "number" && Number.isFinite(shotIndex)
    ? Math.trunc(shotIndex)
    : null;
}

function readAssetProjectId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const projectId = (meta as Record<string, unknown>).projectId;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
}

/** 从 EcomAsset 回填 plan.shots[].videoUrl（Gateway 已成功但 plan 被旧 autosave 覆盖时） */
export async function backfillSeedVideoPlanShotsFromAssets(opts: {
  userId: string;
  projectId: string;
  plan: SeedVideoPlan | null;
  persist?: boolean;
}): Promise<{ plan: SeedVideoPlan | null; changed: boolean }> {
  const shots = opts.plan?.shots ?? [];
  if (shots.length === 0) return { plan: opts.plan, changed: false };

  const missing = shots.some((s) => !s.videoUrl?.trim());
  if (!missing) return { plan: opts.plan, changed: false };

  const assets = await prisma.ecomAsset.findMany({
    where: { userId: opts.userId, module: ECOM_SEED_VIDEO_MODULE, kind: "video" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { ossUrl: true, meta: true },
  });

  const byShotIndex = new Map<number, { videoUrl: string; videoTaskId?: string }>();
  for (const asset of assets) {
    if (readAssetProjectId(asset.meta) !== opts.projectId) continue;
    const shotIndex = readAssetShotIndex(asset.meta);
    const url = asset.ossUrl?.trim();
    if (shotIndex == null || !url || !/^https?:\/\//.test(url)) continue;
    if (byShotIndex.has(shotIndex)) continue;
    const taskId =
      asset.meta && typeof asset.meta === "object"
        ? (asset.meta as Record<string, unknown>).taskId
        : undefined;
    byShotIndex.set(shotIndex, {
      videoUrl: url,
      videoTaskId: typeof taskId === "string" ? taskId : undefined,
    });
  }

  if (byShotIndex.size === 0) return { plan: opts.plan, changed: false };

  let changed = false;
  const nextShots: SeedVideoShot[] = shots.map((shot) => {
    if (shot.videoUrl?.trim()) return shot;
    const found = byShotIndex.get(shot.index);
    if (!found) return shot;
    changed = true;
    return {
      ...shot,
      videoUrl: found.videoUrl,
      videoTaskId: found.videoTaskId ?? shot.videoTaskId,
    };
  });

  if (!changed) return { plan: opts.plan, changed: false };

  const prevPlan = opts.plan ?? {};
  const nextPlan: SeedVideoPlan = { ...prevPlan, shots: nextShots };
  if (opts.persist !== false) {
    const row = await prisma.ecomSeedVideoProject.findFirst({
      where: { id: opts.projectId, userId: opts.userId },
      select: { plan: true },
    });
    const dbPlan = parseSeedVideoPlan(row?.plan) ?? prevPlan;
    await prisma.ecomSeedVideoProject.update({
      where: { id: opts.projectId },
      data: {
        plan: { ...dbPlan, shots: nextShots } as Prisma.InputJsonValue,
      },
    });
  }
  return { plan: nextPlan, changed: true };
}
