import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getBuiltinQrTemplateById,
  listBuiltinQrTemplates,
} from "@/lib/quick-replica/builtin-templates";
import type { QrCategory, QrTemplateJson, QrTemplateListFilters } from "@/lib/quick-replica/qr-types";

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
    source: "user",
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

  const builtin = listBuiltinQrTemplates(filters);

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
    NOT: { ownerUserId: userId },
  };
  if (filters.category) publicWhere.category = filters.category;
  if (filters.kind) publicWhere.kind = filters.kind;
  if (filters.toolKey) publicWhere.toolKey = filters.toolKey;

  const [ownRows, publicRows] = await Promise.all([
    prisma.qrTemplate.findMany({
      where: ownWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.qrTemplate.findMany({
      where: publicWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const merged = dedupeTemplates([
    ...ownRows.map(rowToJson),
    ...publicRows.map(rowToJson),
    ...builtin,
  ]);
  return merged.sort(
    (a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getQrTemplateById(
  userId: string,
  id: string,
): Promise<QrTemplateJson | null> {
  const builtin = getBuiltinQrTemplateById(id);
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
  };
}
