import { Prisma } from "@prisma/client";

import {
  appendModelShotPoseImage,
  modelShotPoseHasGeneratedImage,
} from "@/lib/ecom/model-shot/pose-image-history";
import {
  ECOM_MODEL_SHOT_MODULE,
  parseModelShotPlan,
  type ModelShotPlan,
} from "@/lib/ecom/ecom-model-shot-types";
import { prisma } from "@/lib/prisma";

function readAssetPoseMeta(meta: unknown): { projectId?: string; index?: number } {
  if (!meta || typeof meta !== "object") return {};
  const o = meta as Record<string, unknown>;
  const projectId = typeof o.projectId === "string" ? o.projectId : undefined;
  const index =
    typeof o.index === "number" && Number.isFinite(o.index) ? Math.trunc(o.index) : undefined;
  return { projectId, index };
}

/** 计划项缺图但资产库已有记录时，从 ecomAsset 回填（修复并发丢失或刷新中断） */
export async function recoverModelShotPoseImagesFromAssets(opts: {
  userId: string;
  projectId: string;
  plan: ModelShotPlan;
}): Promise<ModelShotPlan | null> {
  const missingIndexes = opts.plan.items
    .filter((item) => !modelShotPoseHasGeneratedImage(item))
    .map((item) => item.index);
  if (missingIndexes.length === 0) return null;

  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId: opts.userId,
      module: ECOM_MODEL_SHOT_MODULE,
      kind: "image",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, ossUrl: true, meta: true, createdAt: true },
  });

  const byIndex = new Map<number, typeof assets>();
  for (const asset of assets) {
    const { projectId, index } = readAssetPoseMeta(asset.meta);
    if (projectId !== opts.projectId || index == null || index <= 0) continue;
    if (!missingIndexes.includes(index)) continue;
    const list = byIndex.get(index) ?? [];
    list.push(asset);
    byIndex.set(index, list);
  }
  if (byIndex.size === 0) return null;

  let changed = false;
  const items = opts.plan.items.map((item) => {
    const related = byIndex.get(item.index);
    if (!related?.length || modelShotPoseHasGeneratedImage(item)) return item;
    let merged = item;
    for (const asset of related) {
      merged = appendModelShotPoseImage(merged, {
        url: asset.ossUrl,
        assetId: asset.id,
        createdAt: asset.createdAt.toISOString(),
      });
    }
    changed = true;
    return { ...merged, status: "ready" as const };
  });

  if (!changed) return null;
  return { ...opts.plan, items };
}

export async function persistRecoveredModelShotPlan(
  projectId: string,
  plan: ModelShotPlan,
  updatedAt: Date,
): Promise<boolean> {
  const updated = await prisma.ecomModelShotProject.updateMany({
    where: { id: projectId, updatedAt },
    data: { plan: plan as Prisma.InputJsonValue },
  });
  return updated.count === 1;
}
