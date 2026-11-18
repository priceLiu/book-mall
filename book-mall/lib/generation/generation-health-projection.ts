import type { BillingCategory, Prisma } from "@prisma/client";
import {
  billingCategoryToHealthModality,
  GENERATION_HEALTH_MODALITY_ORDER,
  type GenerationHealthModality,
  type GenerationUserFacingBucket as UserFacingBucketKey,
  classifyGenerationUserFacingBucket,
} from "@private/generation-user-facing-error";
import { prismaRead as prisma } from "@/lib/prisma";

export type GenerationHealthCell = {
  success: number;
  USER_CREDITS: number;
  PLATFORM_BILLING: number;
  VENDOR_INPUT: number;
  VENDOR_QUEUE: number;
};

export type GenerationHealthModalityRow = {
  modality: GenerationHealthModality;
  label: string;
  counts: GenerationHealthCell;
};

export type GenerationHealthPayload = {
  totals: GenerationHealthCell;
  bucketTotals: Record<UserFacingBucketKey, number>;
  modalities: GenerationHealthModalityRow[];
};

function emptyCell(): GenerationHealthCell {
  return {
    success: 0,
    USER_CREDITS: 0,
    PLATFORM_BILLING: 0,
    VENDOR_INPUT: 0,
    VENDOR_QUEUE: 0,
  };
}

function bumpCell(
  cell: GenerationHealthCell,
  bucket: UserFacingBucketKey | "success",
  delta: number,
) {
  if (bucket === "success") {
    cell.success += delta;
    return;
  }
  cell[bucket] += delta;
}

function archiveWhere(
  where: Prisma.GatewayRequestLogWhereInput,
): Prisma.GatewayRequestLogArchiveWhereInput {
  return where as Prisma.GatewayRequestLogArchiveWhereInput;
}

async function aggregateSuccess(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<Map<GenerationHealthModality, number>> {
  const succeededWhere = { ...where, status: "SUCCEEDED" as const };
  const [main, arch] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["billingCategory", "requestKind"],
      where: succeededWhere,
      _count: { _all: true },
    }),
    prisma.gatewayRequestLogArchive.groupBy({
      by: ["billingCategory", "requestKind"],
      where: archiveWhere(succeededWhere),
      _count: { _all: true },
    }),
  ]);
  const map = new Map<GenerationHealthModality, number>();
  for (const row of [...main, ...arch]) {
    const modality = billingCategoryToHealthModality(
      row.billingCategory as BillingCategory | null,
      row.requestKind,
    );
    map.set(modality, (map.get(modality) ?? 0) + row._count._all);
  }
  return map;
}

async function aggregateFailed(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<
  { modality: GenerationHealthModality; bucket: UserFacingBucketKey; count: number }[]
> {
  const failedWhere = { ...where, status: "FAILED" as const };
  const [main, arch] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["userFacingBucket", "billingCategory", "requestKind"],
      where: failedWhere,
      _count: { _all: true },
    }),
    prisma.gatewayRequestLogArchive.groupBy({
      by: ["userFacingBucket", "billingCategory", "requestKind"],
      where: archiveWhere(failedWhere),
      _count: { _all: true },
    }),
  ]);

  const out: {
    modality: GenerationHealthModality;
    bucket: UserFacingBucketKey;
    count: number;
  }[] = [];

  for (const row of [...main, ...arch]) {
    if (row.userFacingBucket) {
      const modality = billingCategoryToHealthModality(
        row.billingCategory as BillingCategory | null,
        row.requestKind,
      );
      out.push({
        modality,
        bucket: row.userFacingBucket as UserFacingBucketKey,
        count: row._count._all,
      });
    }
  }

  const [legacyMain, legacyArch] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["failCode", "billingCategory", "requestKind"],
      where: { ...failedWhere, userFacingBucket: null },
      _count: { _all: true },
    }),
    prisma.gatewayRequestLogArchive.groupBy({
      by: ["failCode", "billingCategory", "requestKind"],
      where: { ...archiveWhere(failedWhere), userFacingBucket: null },
      _count: { _all: true },
    }),
  ]);

  const legacyMerged = new Map<string, number>();
  for (const row of [...legacyMain, ...legacyArch]) {
    const key = `${row.failCode ?? ""}|${row.billingCategory ?? ""}|${row.requestKind}`;
    legacyMerged.set(key, (legacyMerged.get(key) ?? 0) + row._count._all);
  }

  for (const [key, count] of legacyMerged) {
    const [failCode, billingCategory, requestKind] = key.split("|");
    const bucket = classifyGenerationUserFacingBucket({ failCode, failMessage: null });
    const modality = billingCategoryToHealthModality(billingCategory, requestKind);
    out.push({ modality, bucket, count });
  }

  return out;
}

export async function fetchGenerationHealthStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<GenerationHealthPayload> {
  const [successMap, failedRows] = await Promise.all([
    aggregateSuccess(where),
    aggregateFailed(where),
  ]);

  const modalityCells = new Map<GenerationHealthModality, GenerationHealthCell>();
  for (const m of GENERATION_HEALTH_MODALITY_ORDER) {
    modalityCells.set(m, emptyCell());
  }

  const totals = emptyCell();
  const bucketTotals: Record<UserFacingBucketKey, number> = {
    USER_CREDITS: 0,
    PLATFORM_BILLING: 0,
    VENDOR_INPUT: 0,
    VENDOR_QUEUE: 0,
  };

  for (const [modality, count] of successMap) {
    const cell = modalityCells.get(modality)!;
    bumpCell(cell, "success", count);
    bumpCell(totals, "success", count);
  }

  for (const row of failedRows) {
    const cell = modalityCells.get(row.modality) ?? emptyCell();
    if (!modalityCells.has(row.modality)) {
      modalityCells.set(row.modality, cell);
    }
    bumpCell(cell, row.bucket, row.count);
    bumpCell(totals, row.bucket, row.count);
    bucketTotals[row.bucket] += row.count;
  }

  const modalities: GenerationHealthModalityRow[] = GENERATION_HEALTH_MODALITY_ORDER.map(
    (modality) => ({
      modality,
      label:
        modality === "IMAGE"
          ? "图片"
          : modality === "VIDEO"
            ? "视频"
            : modality === "MULTIMODAL"
              ? "多模态"
              : modality === "TEXT"
                ? "文本"
                : "音频",
      counts: modalityCells.get(modality) ?? emptyCell(),
    }),
  );

  return { totals, bucketTotals, modalities };
}