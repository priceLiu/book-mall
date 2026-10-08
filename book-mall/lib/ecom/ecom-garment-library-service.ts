import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import {
  buildCatalogViewerScopeOr,
  normalizeCatalogScope,
} from "@/lib/ecom/ecom-catalog-viewer-scope";

export type EcomGarmentLibraryEntry = {
  id: string;
  name: string;
  gender: "female" | "male";
  ossUrl: string;
  thumbUrl?: string | null;
  garmentKind?: string;
  scope?: EcomCatalogScope;
  userId?: string | null;
  tenantId?: string | null;
  sourceProjectId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

function rowToEntry(row: {
  id: string;
  name: string;
  gender: string;
  ossUrl: string;
  thumbUrl: string | null;
  garmentKind: string;
  scope: string;
  userId: string | null;
  tenantId: string | null;
  enabled: boolean;
  sortOrder: number;
}): EcomGarmentLibraryEntry {
  const gender = row.gender === "male" ? "male" : "female";
  const scope = normalizeCatalogScope(row.scope);
  return {
    id: row.id,
    name: row.name,
    gender,
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl,
    garmentKind: row.garmentKind,
    scope,
    userId: row.userId,
    tenantId: row.tenantId,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listGarmentLibraryEntriesForViewer(args: {
  userId: string;
  tenantId?: string | null;
  projectId?: string | null;
  gender?: string | null;
  limit?: number;
}): Promise<EcomGarmentLibraryEntry[]> {
  const limit = Math.min(Math.max(args.limit ?? 120, 1), 240);
  const genderFilter = args.gender?.trim();
  const rows = await prisma.ecomGarmentLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      ...(genderFilter ? { gender: genderFilter } : {}),
      OR: buildCatalogViewerScopeOr({
        userId: args.userId,
        tenantId: args.tenantId,
        projectId: args.projectId,
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(rowToEntry);
}

export async function upsertGarmentLibraryEntry(
  entry: EcomGarmentLibraryEntry,
): Promise<EcomGarmentLibraryEntry> {
  const data = {
    name: entry.name,
    gender: entry.gender,
    ossUrl: entry.ossUrl,
    thumbUrl: entry.thumbUrl ?? entry.ossUrl,
    garmentKind: entry.garmentKind ?? "flat",
    scope: entry.scope ?? "user",
    userId: entry.userId ?? null,
    tenantId: entry.tenantId ?? null,
    sourceProjectId: entry.sourceProjectId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomGarmentLibraryEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function createGarmentFromImport(args: {
  name: string;
  gender: "female" | "male";
  ossUrl: string;
  thumbUrl?: string;
  sourceImageKey?: string;
  scope: EcomCatalogScope;
  userId: string;
  tenantId?: string | null;
  sourceProjectId?: string | null;
  garmentKind?: string;
  idSlug?: string;
  id?: string;
}): Promise<EcomGarmentLibraryEntry> {
  const slug = args.idSlug?.trim() || "garment";
  const id =
    args.id?.trim() ||
    (args.scope === "platform"
      ? `${slug}-${args.gender}-${randomUUID().slice(0, 8)}`
      : `user-${slug}-${randomUUID()}`);
  return upsertGarmentLibraryEntry({
    id,
    name: args.name,
    gender: args.gender,
    ossUrl: args.ossUrl,
    thumbUrl: args.thumbUrl ?? args.ossUrl,
    garmentKind: args.garmentKind?.trim() || "flat",
    scope: args.scope,
    userId: args.scope === "platform" ? null : args.userId,
    tenantId: args.scope === "team" ? args.tenantId ?? null : null,
    sourceProjectId: args.scope === "project" ? args.sourceProjectId ?? null : null,
    enabled: true,
    sortOrder: Date.now() % 100000,
  });
}
