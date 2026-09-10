import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { cascadeDeletePinsBySource } from "@/lib/ai-space/ai-space-pin-service";
import { inferKindFromOssUrl } from "@/lib/ecom/ecom-media-decompose-media";

export const ECOM_GENERATION_RECORD_MODULE = "ecom-generation-record";

const SAVED_WORKFLOW_META_KEYS = [
  "deliverableSnapshot",
  "deliverableSnapshotHistory",
  "workflowSnapshot",
  "workflowSnapshotHistory",
] as const;

export type EcomGenerationRecordMeta = {
  sourceModule: string;
  sourceToolKey?: string;
  projectId?: string;
  sourceResultId?: string;
  versionKey?: string;
  modelKey?: string;
  panelIndex?: number;
};

export type PersistEcomGenerationRecordInput = {
  userId: string;
  ossUrl: string;
  kind?: "image" | "video";
  title?: string;
  prompt?: string | null;
  thumbnailUrl?: string | null;
  meta: EcomGenerationRecordMeta;
};

function snapshotJsonBlobs(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const row = meta as Record<string, unknown>;
  const blobs: string[] = [];
  for (const key of SAVED_WORKFLOW_META_KEYS) {
    const val = row[key];
    if (val != null) blobs.push(JSON.stringify(val));
  }
  return blobs;
}

/** 已暂存/保存的工作流快照中是否引用该 OSS URL */
export async function isOssUrlReferencedInSavedEcomWorkflows(
  userId: string,
  ossUrl: string,
): Promise<boolean> {
  const needle = ossUrl.trim();
  if (!needle) return false;

  const [
    storyboardRows,
    productDesignRows,
    seedVideoRows,
    handCraftRows,
    mediaDecomposeRows,
    modelShotRows,
    videoWorkflowRows,
    filmPullRows,
  ] = await Promise.all([
    prisma.ecomStoryboardProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomProductDesignProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomSeedVideoProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomHandCraftProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomMediaDecomposeProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomModelShotProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomVideoWorkflowProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
    prisma.ecomFilmPullProject.findMany({
      where: { userId },
      select: { meta: true },
    }),
  ]);

  const metas = [
    ...storyboardRows,
    ...productDesignRows,
    ...seedVideoRows,
    ...handCraftRows,
    ...mediaDecomposeRows,
    ...modelShotRows,
    ...videoWorkflowRows,
    ...filmPullRows,
  ];

  for (const { meta } of metas) {
    for (const blob of snapshotJsonBlobs(meta)) {
      if (blob.includes(needle)) return true;
    }
  }
  return false;
}

export async function persistEcomGenerationRecord(
  input: PersistEcomGenerationRecordInput,
): Promise<{ assetId: string; created: boolean }> {
  const ossUrl = input.ossUrl.trim();
  if (!ossUrl) throw new Error("缺少 ossUrl");

  const existing = await prisma.ecomAsset.findFirst({
    where: {
      userId: input.userId,
      module: ECOM_GENERATION_RECORD_MODULE,
      ossUrl,
    },
    select: { id: true },
  });
  if (existing) return { assetId: existing.id, created: false };

  const inferred = inferKindFromOssUrl(ossUrl);
  const kind = input.kind ?? (inferred === "video" ? "video" : "image");
  const title = input.title?.trim() || (kind === "video" ? "生成视频" : "生成图片");

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: input.userId,
      module: ECOM_GENERATION_RECORD_MODULE,
      kind,
      title: title.slice(0, 120),
      prompt: input.prompt?.trim() || null,
      ossUrl,
      thumbnailUrl: input.thumbnailUrl?.trim() || ossUrl,
      meta: input.meta,
    },
  });

  return { assetId: asset.id, created: true };
}

export async function deleteEcomGenerationRecord(
  userId: string,
  assetId: string,
): Promise<void> {
  const row = await prisma.ecomAsset.findFirst({
    where: { id: assetId, userId, module: ECOM_GENERATION_RECORD_MODULE },
  });
  if (!row) throw new Error("未找到生成记录");

  const referenced = await isOssUrlReferencedInSavedEcomWorkflows(userId, row.ossUrl);
  if (referenced) {
    throw new Error("该成片已被工作流引用，无法删除");
  }

  const otherRefs = await prisma.ecomAsset.count({
    where: {
      userId,
      ossUrl: row.ossUrl,
      id: { not: row.id },
    },
  });

  if (otherRefs === 0) {
    await deleteManagedOssObjectByUrl(row.ossUrl).catch(() => undefined);
    if (row.thumbnailUrl && row.thumbnailUrl !== row.ossUrl) {
      await deleteManagedOssObjectByUrl(row.thumbnailUrl).catch(() => undefined);
    }
  }

  await cascadeDeletePinsBySource("ecom_asset", row.id);
  await prisma.ecomAsset.delete({ where: { id: row.id } });
}

export async function listEcomGenerationRecords(userId: string, take = 500) {
  return prisma.ecomAsset.findMany({
    where: { userId, module: ECOM_GENERATION_RECORD_MODULE },
    orderBy: { createdAt: "desc" },
    take,
  });
}
