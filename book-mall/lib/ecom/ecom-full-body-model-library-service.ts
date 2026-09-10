import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";

export type EcomFullBodyModelEntry = {
  id: string;
  name: string;
  gender: "female" | "male";
  ossUrl: string;
  thumbUrl?: string | null;
  sourceAssetId?: string | null;
  scope?: EcomCatalogScope;
  userId?: string | null;
  tenantId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

function rowToEntry(row: {
  id: string;
  name: string;
  gender: string;
  ossUrl: string;
  thumbUrl: string | null;
  sourceAssetId: string | null;
  scope: string;
  userId: string | null;
  tenantId: string | null;
  enabled: boolean;
  sortOrder: number;
}): EcomFullBodyModelEntry {
  const gender = row.gender === "male" ? "male" : "female";
  const scope =
    row.scope === "platform" || row.scope === "team" ? row.scope : "user";
  return {
    id: row.id,
    name: row.name,
    gender,
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl,
    sourceAssetId: row.sourceAssetId,
    scope,
    userId: row.userId,
    tenantId: row.tenantId,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listFullBodyModelsForViewer(args: {
  userId: string;
  tenantId?: string | null;
  gender?: string | null;
  limit?: number;
}): Promise<EcomFullBodyModelEntry[]> {
  const limit = Math.min(Math.max(args.limit ?? 120, 1), 240);
  const genderFilter = args.gender?.trim();
  const rows = await prisma.ecomFullBodyModelEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      ...(genderFilter ? { gender: genderFilter } : {}),
      OR: [
        { scope: "platform" },
        { scope: "user", userId: args.userId },
        ...(args.tenantId
          ? [{ scope: "team" as const, tenantId: args.tenantId }]
          : []),
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(rowToEntry);
}

export async function upsertFullBodyModelEntry(
  entry: EcomFullBodyModelEntry,
): Promise<EcomFullBodyModelEntry> {
  const data = {
    name: entry.name,
    gender: entry.gender,
    ossUrl: entry.ossUrl,
    thumbUrl: entry.thumbUrl ?? entry.ossUrl,
    sourceAssetId: entry.sourceAssetId ?? null,
    scope: entry.scope ?? "user",
    userId: entry.userId ?? null,
    tenantId: entry.tenantId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomFullBodyModelEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function createFullBodyModelFromImport(args: {
  name: string;
  gender: "female" | "male";
  ossUrl: string;
  thumbUrl?: string;
  sourceImageKey?: string;
  sourceAssetId?: string;
  scope: EcomCatalogScope;
  userId: string;
  tenantId?: string | null;
}): Promise<EcomFullBodyModelEntry> {
  const id =
    args.scope === "platform"
      ? `fb-model-${args.gender}-${randomUUID().slice(0, 8)}`
      : `user-fb-model-${randomUUID()}`;
  return upsertFullBodyModelEntry({
    id,
    name: args.name,
    gender: args.gender,
    ossUrl: args.ossUrl,
    thumbUrl: args.thumbUrl ?? args.ossUrl,
    sourceAssetId: args.sourceAssetId,
    scope: args.scope,
    userId: args.scope === "platform" ? null : args.userId,
    tenantId: args.scope === "team" ? args.tenantId ?? null : null,
    enabled: true,
    sortOrder: Date.now() % 100000,
  });
}
