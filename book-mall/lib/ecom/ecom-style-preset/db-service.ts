import { prisma } from "@/lib/prisma";

import { mapStylePresetRow, verticalsToJson, type EcomStylePresetRow } from "./db-mapper";
import { resolveStylePresetThumbUrlForRow } from "./resolve-media";
import type { EcomStylePreset, EcomStylePresetKind, EcomStylePresetVertical } from "./types";

const ACTIVE_WHERE = { deletedAt: null, enabled: true } as const;

export async function listStylePresetRowsFromDb(opts: {
  kind?: EcomStylePresetKind;
  includeDisabled?: boolean;
}): Promise<EcomStylePresetRow[]> {
  return prisma.ecomStylePresetEntry.findMany({
    where: {
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.includeDisabled ? { deletedAt: null } : ACTIVE_WHERE),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function listStylePresetsFromDb(opts: {
  kind?: EcomStylePresetKind;
  includeDisabled?: boolean;
}): Promise<EcomStylePreset[]> {
  const rows = await listStylePresetRowsFromDb(opts);
  return Promise.all(
    rows.map(async (row) => {
      const thumbUrl = await resolveStylePresetThumbUrlForRow(row);
      return mapStylePresetRow(row, { thumbUrl });
    }),
  );
}

export async function getStylePresetRowFromDb(id: string): Promise<EcomStylePresetRow | null> {
  return prisma.ecomStylePresetEntry.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function getStylePresetCatalogVersionFromDb(): Promise<string> {
  const agg = await prisma.ecomStylePresetEntry.aggregate({
    where: { deletedAt: null },
    _max: { updatedAt: true },
  });
  const ts = agg._max.updatedAt?.toISOString().slice(0, 10) ?? "seed";
  return `db-${ts}`;
}

export async function upsertStylePresetEntry(input: {
  id: string;
  kind: EcomStylePresetKind;
  verticals?: EcomStylePresetVertical[];
  title: string;
  subtitle?: string | null;
  layoutPrompt?: string | null;
  visualPrompt?: string | null;
  palette?: string[] | null;
  thumbUrl?: string | null;
  referenceUrl?: string | null;
  sortOrder?: number;
  enabled?: boolean;
}): Promise<EcomStylePreset> {
  const row = await prisma.ecomStylePresetEntry.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      kind: input.kind,
      verticals: verticalsToJson(input.verticals ?? []),
      title: input.title,
      subtitle: input.subtitle ?? null,
      layoutPrompt: input.layoutPrompt ?? null,
      visualPrompt: input.visualPrompt ?? null,
      palette: input.palette ?? undefined,
      thumbUrl: input.thumbUrl ?? null,
      referenceUrl: input.referenceUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
      enabled: input.enabled !== false,
    },
    update: {
      kind: input.kind,
      verticals: verticalsToJson(input.verticals ?? []),
      title: input.title,
      subtitle: input.subtitle ?? null,
      layoutPrompt: input.layoutPrompt ?? null,
      visualPrompt: input.visualPrompt ?? null,
      palette: input.palette ?? undefined,
      thumbUrl: input.thumbUrl ?? null,
      referenceUrl: input.referenceUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
      enabled: input.enabled !== false,
      deletedAt: null,
    },
  });
  return mapStylePresetRow(row);
}

export async function patchStylePresetEntry(
  id: string,
  patch: Partial<{
    title: string;
    subtitle: string | null;
    layoutPrompt: string | null;
    visualPrompt: string | null;
    thumbUrl: string | null;
    referenceUrl: string | null;
    sortOrder: number;
    enabled: boolean;
    verticals: EcomStylePresetVertical[];
  }>,
): Promise<EcomStylePreset | null> {
  const existing = await getStylePresetRowFromDb(id);
  if (!existing) return null;
  const row = await prisma.ecomStylePresetEntry.update({
    where: { id },
    data: {
      title: patch.title ?? existing.title,
      subtitle: patch.subtitle !== undefined ? patch.subtitle : existing.subtitle,
      layoutPrompt:
        patch.layoutPrompt !== undefined ? patch.layoutPrompt : existing.layoutPrompt,
      visualPrompt:
        patch.visualPrompt !== undefined ? patch.visualPrompt : existing.visualPrompt,
      thumbUrl: patch.thumbUrl !== undefined ? patch.thumbUrl : existing.thumbUrl,
      referenceUrl:
        patch.referenceUrl !== undefined ? patch.referenceUrl : existing.referenceUrl,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      enabled: patch.enabled ?? existing.enabled,
      verticals:
        patch.verticals !== undefined ? verticalsToJson(patch.verticals) : undefined,
    },
  });
  return mapStylePresetRow(row);
}

export async function softDeleteStylePresetEntry(id: string): Promise<boolean> {
  const existing = await getStylePresetRowFromDb(id);
  if (!existing) return false;
  await prisma.ecomStylePresetEntry.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false },
  });
  return true;
}
