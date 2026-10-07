import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { normalizeCatalogScope } from "@/lib/ecom/ecom-catalog-viewer-scope";
import { buildCatalogViewerScopeOr } from "@/lib/ecom/ecom-catalog-viewer-scope";
import { prisma } from "@/lib/prisma";

export type EcomStyleLibraryEntry = {
  id: string;
  name: string;
  stylePrompt: string;
  ossUrl?: string | null;
  thumbUrl?: string | null;
  sourceImageKey?: string | null;
  tags?: Record<string, unknown>;
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
  stylePrompt: string;
  ossUrl: string | null;
  thumbUrl: string | null;
  sourceImageKey: string | null;
  tags: unknown;
  scope: string;
  userId: string | null;
  tenantId: string | null;
  sourceProjectId: string | null;
  enabled: boolean;
  sortOrder: number;
}): EcomStyleLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    stylePrompt: row.stylePrompt,
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl,
    sourceImageKey: row.sourceImageKey,
    tags:
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : undefined,
    scope: normalizeCatalogScope(row.scope),
    userId: row.userId,
    tenantId: row.tenantId,
    sourceProjectId: row.sourceProjectId,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listStyleLibraryEntriesForViewer(args: {
  userId: string;
  tenantId?: string | null;
  projectId?: string | null;
  limit?: number;
}): Promise<EcomStyleLibraryEntry[]> {
  const limit = Math.min(Math.max(args.limit ?? 120, 1), 240);
  const rows = await prisma.ecomStyleLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
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

export async function upsertStyleLibraryEntry(
  entry: EcomStyleLibraryEntry,
): Promise<EcomStyleLibraryEntry> {
  const data = {
    name: entry.name,
    stylePrompt: entry.stylePrompt,
    ossUrl: entry.ossUrl ?? null,
    thumbUrl: entry.thumbUrl ?? null,
    sourceImageKey: entry.sourceImageKey ?? null,
    tags: entry.tags ? (entry.tags as Prisma.InputJsonValue) : undefined,
    scope: entry.scope ?? "user",
    userId: entry.userId ?? null,
    tenantId: entry.tenantId ?? null,
    sourceProjectId: entry.sourceProjectId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomStyleLibraryEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function createStyleFromImport(args: {
  name: string;
  stylePrompt: string;
  ossUrl: string;
  thumbUrl?: string;
  sourceImageKey?: string;
  tags?: Record<string, unknown>;
  scope: EcomCatalogScope;
  userId: string;
  tenantId?: string | null;
  sourceProjectId?: string | null;
}): Promise<EcomStyleLibraryEntry> {
  const id =
    args.scope === "platform"
      ? `style-${randomUUID().slice(0, 8)}`
      : `user-style-${randomUUID()}`;
  return upsertStyleLibraryEntry({
    id,
    name: args.name,
    stylePrompt: args.stylePrompt,
    ossUrl: args.ossUrl,
    thumbUrl: args.thumbUrl ?? args.ossUrl,
    sourceImageKey: args.sourceImageKey,
    tags: args.tags,
    scope: args.scope,
    userId: args.scope === "platform" ? null : args.userId,
    tenantId: args.scope === "team" ? args.tenantId ?? null : null,
    sourceProjectId: args.scope === "project" ? args.sourceProjectId ?? null : null,
    enabled: true,
    sortOrder: Date.now() % 100000,
  });
}
