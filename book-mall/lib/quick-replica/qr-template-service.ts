import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getBuiltinQrTemplateById,
  listBuiltinQrTemplates,
} from "@/lib/quick-replica/builtin-templates";
import { filterTemplatesForGallery } from "@/lib/quick-replica/qr-template-catalog";
import type { QrCategory, QrTemplateJson, QrTemplateListFilters } from "@/lib/quick-replica/qr-types";

function mergeBuiltinWithOverride(
  builtin: QrTemplateJson,
  override: QrTemplateJson,
): QrTemplateJson {
  return {
    ...override,
    id: builtin.id,
    source: "builtin",
    visibility: "public",
  };
}

async function loadCatalogOverrideMap(): Promise<Map<string, QrTemplateJson>> {
  const rows = await prisma.qrTemplate.findMany({
    where: { catalogBuiltinId: { not: null }, deletedAt: null },
  });
  const map = new Map<string, QrTemplateJson>();
  for (const row of rows) {
    if (!row.catalogBuiltinId) continue;
    map.set(row.catalogBuiltinId, rowToJson(row));
  }
  return map;
}

function applyCatalogOverridesToBuiltin(
  builtins: QrTemplateJson[],
  overrideMap: Map<string, QrTemplateJson>,
): QrTemplateJson[] {
  return builtins.map((b) => {
    const override = overrideMap.get(b.id);
    return override ? mergeBuiltinWithOverride(b, override) : b;
  });
}

export function rowToJson(row: {
  id: string;
  category: string;
  kind: string;
  toolKey: string | null;
  title: string;
  thumbnailUrl: string;
  badges: unknown;
  ownerUserId: string | null;
  visibility: string;
  isPlatformCatalog?: boolean;
  reference: unknown;
  output: unknown;
  sortOrder: number;
  gatewayRequestLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): QrTemplateJson {
  return {
    schemaVersion: 1,
    id: row.id,
    category: row.category as QrCategory,
    kind: row.kind,
    toolKey: row.toolKey ?? undefined,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    badges: Array.isArray(row.badges)
      ? (row.badges as QrTemplateJson["badges"])
      : undefined,
    source: row.isPlatformCatalog ? "catalog" : "user",
    ownerUserId: row.ownerUserId ?? undefined,
    visibility: row.visibility === "public" ? "public" : "private",
    reference: row.reference as QrTemplateJson["reference"],
    output: row.output ? (row.output as QrTemplateJson["output"]) : undefined,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dedupeTemplates(items: QrTemplateJson[]): QrTemplateJson[] {
  const seen = new Set<string>();
  const out: QrTemplateJson[] = [];
  for (const t of items) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/** 运营库公开模板（ownerUserId 为 null，不能走 NOT ownerUserId 的 public 查询） */
export function buildPlatformCatalogWhere(
  filters: QrTemplateListFilters,
): Prisma.QrTemplateWhereInput {
  const where: Prisma.QrTemplateWhereInput = {
    deletedAt: null,
    visibility: "public",
    isPlatformCatalog: true,
    catalogBuiltinId: null,
  };
  if (filters.category) where.category = filters.category;
  if (filters.kind) where.kind = filters.kind;
  if (filters.toolKey) {
    where.OR = [
      { toolKey: filters.toolKey },
      ...(filters.toolKey === "motion-sync"
        ? [{ kind: "motion-sync", toolKey: null }]
        : []),
    ];
  }
  return where;
}

export async function listQrTemplates(
  userId: string,
  filters: QrTemplateListFilters,
): Promise<QrTemplateJson[]> {
  const scope = filters.scope ?? "all";

  if (scope === "my") {
    const where: Prisma.QrTemplateWhereInput = {
      ownerUserId: userId,
      deletedAt: null,
    };
    if (filters.category) where.category = filters.category;
    if (filters.kind) where.kind = filters.kind;
    if (filters.toolKey) where.toolKey = filters.toolKey;
    const userRows = await prisma.qrTemplate.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return userRows.map(rowToJson);
  }

  const builtinRaw = listBuiltinQrTemplates(filters);
  const overrideMap = await loadCatalogOverrideMap();
  const builtin = applyCatalogOverridesToBuiltin(builtinRaw, overrideMap);

  const ownWhere: Prisma.QrTemplateWhereInput = {
    ownerUserId: userId,
    deletedAt: null,
  };
  if (filters.category) ownWhere.category = filters.category;
  if (filters.kind) ownWhere.kind = filters.kind;
  if (filters.toolKey) ownWhere.toolKey = filters.toolKey;

  const publicWhere: Prisma.QrTemplateWhereInput = {
    visibility: "public",
    deletedAt: null,
    catalogBuiltinId: null,
    isPlatformCatalog: false,
    ownerUserId: { not: userId },
  };
  if (filters.category) publicWhere.category = filters.category;
  if (filters.kind) publicWhere.kind = filters.kind;
  if (filters.toolKey) publicWhere.toolKey = filters.toolKey;

  const catalogWhere = buildPlatformCatalogWhere(filters);

  const [ownRows, publicRows, catalogRows] = await Promise.all([
    prisma.qrTemplate.findMany({
      where: ownWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.qrTemplate.findMany({
      where: publicWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.qrTemplate.findMany({
      where: catalogWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const merged = dedupeTemplates([
    ...ownRows.map(rowToJson),
    ...publicRows.map(rowToJson),
    ...catalogRows.map(rowToJson),
    ...builtin,
  ]);
  const filtered = filterTemplatesForGallery(merged, filters);
  return filtered.sort(
    (a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getQrTemplateById(
  userId: string,
  id: string,
): Promise<QrTemplateJson | null> {
  const overrideRow = await prisma.qrTemplate.findFirst({
    where: { catalogBuiltinId: id, deletedAt: null, visibility: "public" },
  });
  const builtin = getBuiltinQrTemplateById(id);
  if (builtin && overrideRow) {
    return mergeBuiltinWithOverride(builtin, rowToJson(overrideRow));
  }
  if (builtin) return builtin;

  const row = await prisma.qrTemplate.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [{ ownerUserId: userId }, { visibility: "public" }],
    },
  });
  return row ? rowToJson(row) : null;
}

export async function findQrTemplateByLogId(logId: string): Promise<QrTemplateJson | null> {
  const row = await prisma.qrTemplate.findFirst({
    where: { gatewayRequestLogId: logId, deletedAt: null },
  });
  return row ? rowToJson(row) : null;
}

function draftToTemplateReference(
  draft: import("@/lib/quick-replica/qr-types").QrWorkspaceDraft,
): QrTemplateJson["reference"] {
  const slots: QrTemplateJson["reference"]["slots"] = {};
  if (draft.targetImageUrl.trim()) {
    slots.targetImage = { url: draft.targetImageUrl.trim() };
  }
  if (draft.referenceVideoUrl.trim()) {
    slots.referenceVideo = { url: draft.referenceVideoUrl.trim() };
  }
  if (draft.referenceAudioUrl.trim()) {
    slots.referenceAudio = { url: draft.referenceAudioUrl.trim() };
  }
  if (draft.sceneImageUrls.length > 0) {
    slots.sceneImages = draft.sceneImageUrls
      .filter((url) => url.trim())
      .map((url) => ({ url: url.trim() }));
  }
  const role: QrTemplateJson["reference"]["model"]["role"] =
    draft.category === "audio"
      ? "AUDIO"
      : draft.category === "image"
        ? "IMAGE"
        : "VIDEO";
  return {
    slots,
    prompt: { text: draft.prompt },
    model: {
      role,
      modelKey: draft.modelKey,
      params: {
        ...(draft.mode ? { mode: draft.mode } : {}),
        ...(draft.characterOrientation
          ? { character_orientation: draft.characterOrientation }
          : {}),
      },
    },
  };
}

function resolveDraftThumbnailUrl(
  draft: import("@/lib/quick-replica/qr-types").QrWorkspaceDraft,
): string {
  return (
    draft.targetImageUrl.trim() ||
    draft.referenceVideoUrl.trim() ||
    draft.sceneImageUrls.find((url) => url.trim())?.trim() ||
    ""
  );
}

export async function createUserQrTemplate(args: {
  userId: string;
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  reference: QrTemplateJson["reference"];
  output?: QrTemplateJson["output"];
  gatewayRequestLogId?: string;
  sortOrder?: number;
  visibility?: "private" | "public";
}): Promise<QrTemplateJson> {
  const row = await prisma.qrTemplate.create({
    data: {
      ownerUserId: args.userId,
      category: args.category,
      kind: args.kind,
      toolKey: args.toolKey ?? null,
      title: args.title,
      thumbnailUrl: args.thumbnailUrl,
      badges: [],
      visibility: args.visibility ?? "private",
      reference: args.reference as Prisma.InputJsonValue,
      output: args.output ? (args.output as Prisma.InputJsonValue) : undefined,
      sortOrder: args.sortOrder ?? 0,
      gatewayRequestLogId: args.gatewayRequestLogId ?? null,
    },
  });
  return rowToJson(row);
}

export async function updateUserQrTemplate(args: {
  userId: string;
  id: string;
  draft: import("@/lib/quick-replica/qr-types").QrWorkspaceDraft;
}): Promise<QrTemplateJson | null> {
  const existing = await prisma.qrTemplate.findFirst({
    where: { id: args.id, ownerUserId: args.userId, deletedAt: null },
  });
  if (!existing) return null;

  const reference = draftToTemplateReference(args.draft);
  const thumbnailUrl =
    resolveDraftThumbnailUrl(args.draft) || existing.thumbnailUrl;
  const title =
    args.draft.title?.trim() ||
    existing.title ||
    args.draft.kind;

  const row = await prisma.qrTemplate.update({
    where: { id: args.id },
    data: {
      category: args.draft.category,
      kind: args.draft.kind,
      toolKey: args.draft.toolKey ?? null,
      title,
      thumbnailUrl,
      reference: reference as Prisma.InputJsonValue,
    },
  });
  return rowToJson(row);
}

export async function deleteUserQrTemplate(
  userId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.qrTemplate.findFirst({
    where: { id, ownerUserId: userId, deletedAt: null },
  });
  if (!existing) return false;
  await prisma.qrTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function deleteAdminUserQrTemplate(id: string): Promise<boolean> {
  const existing = await prisma.qrTemplate.findFirst({
    where: {
      id,
      deletedAt: null,
      catalogBuiltinId: null,
      ownerUserId: { not: null },
    },
  });
  if (!existing) return false;
  await prisma.qrTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function listAdminUserQrTemplates(filters: {
  category?: QrCategory | null;
  kind?: string | null;
  limit?: number;
}): Promise<QrTemplateJson[]> {
  const where: Prisma.QrTemplateWhereInput = {
    ownerUserId: { not: null },
    catalogBuiltinId: null,
    deletedAt: null,
  };
  if (filters.category) where.category = filters.category;
  if (filters.kind) where.kind = filters.kind;
  const rows = await prisma.qrTemplate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, filters.limit ?? 100)),
  });
  return rows.map(rowToJson);
}

export function templateToWorkspaceDraft(
  t: QrTemplateJson,
): import("@/lib/quick-replica/qr-types").QrWorkspaceDraft {
  const sceneImageUrls =
    t.reference.slots.sceneImages?.map((s) => s.url).filter(Boolean) ?? [];
  return {
    category: t.category,
    kind: t.kind,
    toolKey: t.toolKey,
    title: t.title,
    targetImageUrl: t.reference.slots.targetImage?.url ?? "",
    referenceVideoUrl: t.reference.slots.referenceVideo?.url ?? "",
    referenceAudioUrl: t.reference.slots.referenceAudio?.url ?? "",
    sceneImageUrls,
    prompt: t.reference.prompt.text,
    modelKey: t.reference.model.modelKey,
    mode:
      typeof t.reference.model.params.mode === "string"
        ? t.reference.model.params.mode
        : undefined,
    characterOrientation:
      typeof t.reference.model.params.character_orientation === "string"
        ? t.reference.model.params.character_orientation
        : undefined,
  };
}

export function defaultWorkspaceDraft(input: {
  category: QrCategory;
  kind: string;
  toolKey?: string;
}): import("@/lib/quick-replica/qr-types").QrWorkspaceDraft {
  return {
    category: input.category,
    kind: input.kind,
    toolKey: input.toolKey,
    targetImageUrl: "",
    referenceVideoUrl: "",
    referenceAudioUrl: "",
    sceneImageUrls: [],
    prompt: "",
    modelKey:
      input.kind === "motion-sync"
        ? "kling-2.6/motion-control"
        : "lib-nano-pro",
    mode: input.kind === "motion-sync" ? "std" : undefined,
    characterOrientation: input.kind === "motion-sync" ? "video" : undefined,
  };
}
