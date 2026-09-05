import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ProductDesign } from "@/lib/ecom/ecom-product-design-types";
import {
  ECOM_PROJECT_MODULE_DETAIL,
  ECOM_PROJECT_MODULE_LEGACY,
  ECOM_PROJECT_MODULE_MAIN,
} from "@/lib/ecom/ecom-product-design-types";
import { buildProjectNameLookup } from "@/lib/ecom/ecom-library-project-names";
import {
  ECOM_STORYBOARD_MODULE,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";

type ProjectRef = { projectId: string; projectName: string };

function assetMetaNeedsProjectName(meta: Record<string, unknown> | null): boolean {
  const name = meta?.projectName;
  return typeof name !== "string" || !name.trim();
}

function resolveProductDesignProjectName(row: {
  brief: unknown;
  title: string | null;
  meta: unknown;
}): string {
  const brief = row.brief as { productName?: string } | null;
  if (brief?.productName?.trim()) return brief.productName.trim();
  if (row.title?.trim()) return row.title.trim();
  const meta = row.meta as Record<string, unknown> | null;
  const snap = meta?.workflowSnapshot as { productName?: string; title?: string } | undefined;
  if (snap?.productName?.trim()) return snap.productName.trim();
  if (snap?.title?.trim()) return snap.title.trim();
  return "未命名项目";
}

function resolveStoryboardProjectName(row: {
  title: string | null;
  sheet: unknown;
  meta: unknown;
}): string {
  const meta = row.meta as Record<string, unknown> | null;
  const snap = meta?.deliverableSnapshot as { productName?: string; title?: string } | undefined;
  if (snap?.productName?.trim()) return snap.productName.trim();
  if (snap?.title?.trim()) return snap.title.trim();
  const sheet = row.sheet as StoryboardSheet | null;
  if (sheet?.overview?.title?.trim()) return sheet.overview.title.trim();
  if (row.title?.trim()) return row.title.trim();
  return "未命名项目";
}

function buildAssetIdToProjectMap(
  rows: Array<{
    id: string;
    brief: unknown;
    title: string | null;
    meta: unknown;
    design: unknown;
  }>,
): Map<string, ProjectRef> {
  const map = new Map<string, ProjectRef>();
  for (const row of rows) {
    const ref: ProjectRef = {
      projectId: row.id,
      projectName: resolveProductDesignProjectName(row),
    };
    const design = row.design as ProductDesign | null;
    for (const slot of design?.mainImages ?? []) {
      if (slot.assetId?.trim()) map.set(slot.assetId.trim(), ref);
    }
    for (const slot of design?.detailPages ?? []) {
      if (slot.assetId?.trim()) map.set(slot.assetId.trim(), ref);
    }
  }
  return map;
}

function normalizeMediaUrl(url: string): string {
  return url.trim().split("?")[0] ?? url.trim();
}

function buildOssUrlToStoryboardMap(
  rows: Array<{
    id: string;
    title: string | null;
    sheet: unknown;
    meta: unknown;
    videoAssetId: string | null;
  }>,
): Map<string, ProjectRef> {
  const map = new Map<string, ProjectRef>();
  for (const row of rows) {
    const ref: ProjectRef = {
      projectId: row.id,
      projectName: resolveStoryboardProjectName(row),
    };
    const sheet = row.sheet as StoryboardSheet | null;
    for (const panel of sheet?.panels ?? []) {
      if (panel.imageUrl?.trim()) {
        map.set(normalizeMediaUrl(panel.imageUrl), ref);
      }
      if (panel.videoUrl?.trim()) {
        map.set(normalizeMediaUrl(panel.videoUrl), ref);
      }
    }
  }
  return map;
}

function buildVideoAssetIdToStoryboardMap(
  rows: Array<{
    id: string;
    title: string | null;
    sheet: unknown;
    meta: unknown;
    videoAssetId: string | null;
  }>,
): Map<string, ProjectRef> {
  const map = new Map<string, ProjectRef>();
  for (const row of rows) {
    if (!row.videoAssetId?.trim()) continue;
    map.set(row.videoAssetId.trim(), {
      projectId: row.id,
      projectName: resolveStoryboardProjectName(row),
    });
  }
  return map;
}

function buildStoryboardProjectIdMap(
  rows: Array<{
    id: string;
    title: string | null;
    sheet: unknown;
    meta: unknown;
  }>,
): Map<string, ProjectRef> {
  const map = new Map<string, ProjectRef>();
  for (const row of rows) {
    map.set(row.id, {
      projectId: row.id,
      projectName: resolveStoryboardProjectName(row),
    });
  }
  return map;
}

function buildProductDesignProjectIdMap(
  rows: Array<{
    id: string;
    brief: unknown;
    title: string | null;
    meta: unknown;
  }>,
): Map<string, ProjectRef> {
  const map = new Map<string, ProjectRef>();
  for (const row of rows) {
    map.set(row.id, {
      projectId: row.id,
      projectName: resolveProductDesignProjectName(row),
    });
  }
  return map;
}

function resolveAssetProjectRef(
  asset: { id: string; ossUrl: string; meta: unknown },
  projectNameLookup: Map<string, string>,
  productDesignProjectIdMap: Map<string, ProjectRef>,
  storyboardProjectIdMap: Map<string, ProjectRef>,
  assetIdToProject: Map<string, ProjectRef>,
  ossUrlToStoryboard: Map<string, ProjectRef>,
  videoAssetIdToStoryboard: Map<string, ProjectRef>,
): ProjectRef | null {
  const meta = (asset.meta as Record<string, unknown> | null) ?? null;
  const projectId =
    typeof meta?.projectId === "string" && meta.projectId.trim()
      ? meta.projectId.trim()
      : null;

  if (projectId) {
    const fromLookup = projectNameLookup.get(projectId)?.trim();
    if (fromLookup) return { projectId, projectName: fromLookup };

    const fromProductDesign = productDesignProjectIdMap.get(projectId);
    if (fromProductDesign && fromProductDesign.projectName !== "未命名项目") {
      return fromProductDesign;
    }

    const fromStoryboard = storyboardProjectIdMap.get(projectId);
    if (fromStoryboard && fromStoryboard.projectName !== "未命名项目") {
      return fromStoryboard;
    }
  }

  const fromAssetId = assetIdToProject.get(asset.id);
  if (fromAssetId) return fromAssetId;

  const fromVideoAsset = videoAssetIdToStoryboard.get(asset.id);
  if (fromVideoAsset) return fromVideoAsset;

  const fromOss = ossUrlToStoryboard.get(normalizeMediaUrl(asset.ossUrl));
  if (fromOss) return fromOss;

  if (projectId) {
    return { projectId, projectName: "未命名项目" };
  }

  return null;
}

export async function backfillEcomAssetProjectNamesForUser(
  userId: string,
): Promise<{ updated: number; skipped: number }> {
  const [assets, storyboardRows, productDesignRows] = await Promise.all([
    prisma.ecomAsset.findMany({
      where: { userId },
      select: { id: true, ossUrl: true, meta: true },
    }),
    prisma.ecomStoryboardProject.findMany({
      where: { userId, module: ECOM_STORYBOARD_MODULE },
      select: { id: true, title: true, sheet: true, meta: true, videoAssetId: true },
    }),
    prisma.ecomProductDesignProject.findMany({
      where: {
        userId,
        module: {
          in: [ECOM_PROJECT_MODULE_MAIN, ECOM_PROJECT_MODULE_DETAIL, ECOM_PROJECT_MODULE_LEGACY],
        },
      },
      select: { id: true, brief: true, title: true, meta: true, design: true },
    }),
  ]);

  const projectNameLookup = buildProjectNameLookup(productDesignRows, storyboardRows);
  const productDesignProjectIdMap = buildProductDesignProjectIdMap(productDesignRows);
  const storyboardProjectIdMap = buildStoryboardProjectIdMap(storyboardRows);
  const assetIdToProject = buildAssetIdToProjectMap(productDesignRows);
  const ossUrlToStoryboard = buildOssUrlToStoryboardMap(storyboardRows);
  const videoAssetIdToStoryboard = buildVideoAssetIdToStoryboardMap(storyboardRows);

  let updated = 0;
  let skipped = 0;

  for (const asset of assets) {
    const meta = (asset.meta as Record<string, unknown> | null) ?? null;
    if (!assetMetaNeedsProjectName(meta)) {
      skipped += 1;
      continue;
    }

    const resolved = resolveAssetProjectRef(
      asset,
      projectNameLookup,
      productDesignProjectIdMap,
      storyboardProjectIdMap,
      assetIdToProject,
      ossUrlToStoryboard,
      videoAssetIdToStoryboard,
    );
    if (!resolved || resolved.projectName === "未命名项目") {
      skipped += 1;
      continue;
    }

    const nextMeta: Record<string, unknown> = {
      ...(meta ?? {}),
      projectId: resolved.projectId,
      projectName: resolved.projectName,
    };

    await prisma.ecomAsset.update({
      where: { id: asset.id },
      data: { meta: nextMeta as Prisma.InputJsonValue },
    });
    updated += 1;
  }

  return { updated, skipped };
}

export async function backfillEcomAssetProjectNamesForAllUsers(): Promise<{
  users: number;
  updated: number;
  skipped: number;
}> {
  const userIds = await prisma.ecomAsset.findMany({
    distinct: ["userId"],
    select: { userId: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const { userId } of userIds) {
    const result = await backfillEcomAssetProjectNamesForUser(userId);
    updated += result.updated;
    skipped += result.skipped;
  }

  return { users: userIds.length, updated, skipped };
}
