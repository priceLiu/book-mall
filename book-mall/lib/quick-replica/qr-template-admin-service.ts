import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getBuiltinQrTemplateById,
  listBuiltinQrTemplates,
} from "@/lib/quick-replica/builtin-templates";
import { getKindDef, getKindsForCategory } from "@/lib/quick-replica/qr-kinds";
import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";
import { rowToJson } from "@/lib/quick-replica/qr-template-service";

export type AdminQrTemplateRow = {
  id: string;
  dbId: string | null;
  catalogBuiltinId: string | null;
  source: "builtin" | "catalog";
  hasOverride: boolean;
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  promptText: string;
  reference: QrTemplateJson["reference"];
  output?: QrTemplateJson["output"];
  sortOrder: number;
  mediaType: "image" | "video" | "audio";
  updatedAt: string;
};

function inferMediaType(
  t: Pick<QrTemplateJson, "category" | "reference" | "thumbnailUrl">,
): "image" | "video" | "audio" {
  if (t.category === "audio") return "audio";
  if (t.reference.slots.referenceVideo?.url) return "video";
  if (t.category === "video") return "video";
  const thumb = t.thumbnailUrl.toLowerCase();
  if (/\.(mp4|webm|mov)(\?|$)/.test(thumb)) return "video";
  return "image";
}

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

export async function loadCatalogOverrideMap(): Promise<Map<string, QrTemplateJson>> {
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

export function applyCatalogOverridesToBuiltin(
  builtins: QrTemplateJson[],
  overrideMap: Map<string, QrTemplateJson>,
): QrTemplateJson[] {
  return builtins.map((b) => {
    const override = overrideMap.get(b.id);
    return override ? mergeBuiltinWithOverride(b, override) : b;
  });
}

export async function listAdminQrTemplates(filters: {
  category?: QrCategory | null;
  kind?: string | null;
}): Promise<AdminQrTemplateRow[]> {
  const overrideMap = await loadCatalogOverrideMap();

  const overrideRows = await prisma.qrTemplate.findMany({
    where: { catalogBuiltinId: { not: null }, deletedAt: null },
    select: { id: true, catalogBuiltinId: true },
  });
  const dbIdByBuiltin = new Map(
    overrideRows
      .filter((r) => r.catalogBuiltinId)
      .map((r) => [r.catalogBuiltinId!, r.id]),
  );

  const builtinRows: AdminQrTemplateRow[] = listBuiltinQrTemplates(filters).map((builtin) => {
    const override = overrideMap.get(builtin.id);
    const effective = override ? mergeBuiltinWithOverride(builtin, override) : builtin;
    return {
      id: builtin.id,
      dbId: dbIdByBuiltin.get(builtin.id) ?? null,
      catalogBuiltinId: builtin.id,
      source: "builtin",
      hasOverride: Boolean(override),
      category: effective.category,
      kind: effective.kind,
      toolKey: effective.toolKey,
      title: effective.title,
      thumbnailUrl: effective.thumbnailUrl,
      promptText: effective.reference.prompt.text,
      reference: effective.reference,
      output: effective.output,
      sortOrder: effective.sortOrder,
      mediaType: inferMediaType(effective),
      updatedAt: effective.updatedAt,
    };
  });

  const catalogWhere: Prisma.QrTemplateWhereInput = {
    deletedAt: null,
    isPlatformCatalog: true,
    catalogBuiltinId: null,
  };
  if (filters.category) catalogWhere.category = filters.category;
  if (filters.kind) catalogWhere.kind = filters.kind;

  const catalogRows = await prisma.qrTemplate.findMany({
    where: catalogWhere,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const platformRows: AdminQrTemplateRow[] = catalogRows.map((row) => {
    const json = rowToJson(row);
    return {
      id: json.id,
      dbId: json.id,
      catalogBuiltinId: null,
      source: "catalog",
      hasOverride: false,
      category: json.category,
      kind: json.kind,
      toolKey: json.toolKey,
      title: json.title,
      thumbnailUrl: json.thumbnailUrl,
      promptText: json.reference.prompt.text,
      reference: json.reference,
      output: json.output,
      sortOrder: json.sortOrder,
      mediaType: inferMediaType(json),
      updatedAt: json.updatedAt,
    };
  });

  return [...builtinRows, ...platformRows].sort(
    (a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt),
  );
}

function defaultReference(args: {
  category: QrCategory;
  kind: string;
  toolKey?: string;
  promptText: string;
  thumbnailUrl: string;
  mediaUrl?: string;
  modelKey?: string;
}): QrTemplateJson["reference"] {
  const mediaUrl = args.mediaUrl?.trim() || args.thumbnailUrl;
  const modelKey =
    args.modelKey?.trim() ||
    (args.kind === "motion-sync"
      ? "kling-2.6/motion-control"
      : args.category === "video"
        ? "wan/2-6-video-to-video"
        : args.kind === "edit-image"
          ? "gpt-image-2"
          : "lib-nano-pro");
  const role =
    args.category === "video" ? "VIDEO" : args.category === "audio" ? "AUDIO" : "IMAGE";

  const slots: QrTemplateJson["reference"]["slots"] = {};
  if (args.category === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl)) {
    slots.referenceVideo = { url: mediaUrl };
  } else if (args.kind === "edit-image" || args.toolKey === "edit-image") {
    slots.targetImage = { url: mediaUrl };
  }

  return {
    slots,
    prompt: {
      text: args.promptText,
      locale: /[\u4e00-\u9fff]/.test(args.promptText) ? "zh" : "en",
    },
    model: {
      role,
      modelKey,
      params: {},
    },
  };
}

export async function upsertAdminQrTemplate(args: {
  adminUserId: string;
  catalogBuiltinId?: string | null;
  dbId?: string | null;
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  promptText: string;
  mediaUrl?: string;
  modelKey?: string;
  sortOrder?: number;
}): Promise<AdminQrTemplateRow> {
  if (!getKindDef(args.kind)) {
    throw new Error(`未知 kind: ${args.kind}`);
  }
  const kinds = getKindsForCategory(args.category);
  if (!kinds.some((k) => k.id === args.kind)) {
    throw new Error(`kind ${args.kind} 不属于分类 ${args.category}`);
  }

  const reference = defaultReference({
    category: args.category,
    kind: args.kind,
    toolKey: args.toolKey,
    promptText: args.promptText,
    thumbnailUrl: args.thumbnailUrl,
    mediaUrl: args.mediaUrl,
    modelKey: args.modelKey,
  });

  const data = {
    category: args.category,
    kind: args.kind,
    toolKey: args.toolKey ?? null,
    title: args.title.trim(),
    thumbnailUrl: args.thumbnailUrl.trim(),
    reference: reference as Prisma.InputJsonValue,
    sortOrder: args.sortOrder ?? 0,
    visibility: "public",
    isPlatformCatalog: true,
    ownerUserId: null,
    badges: [] as Prisma.InputJsonValue,
  };

  let row;
  if (args.dbId) {
    const existing = await prisma.qrTemplate.findFirst({
      where: { id: args.dbId, deletedAt: null },
    });
    if (!existing) throw new Error("模板不存在");
    row = await prisma.qrTemplate.update({
      where: { id: args.dbId },
      data: {
        ...data,
        catalogBuiltinId: args.catalogBuiltinId ?? existing.catalogBuiltinId,
      },
    });
  } else if (args.catalogBuiltinId) {
    const builtin = getBuiltinQrTemplateById(args.catalogBuiltinId);
    if (!builtin) throw new Error("内置模板不存在");
    row = await prisma.qrTemplate.upsert({
      where: { catalogBuiltinId: args.catalogBuiltinId },
      create: {
        ...data,
        catalogBuiltinId: args.catalogBuiltinId,
      },
      update: data,
    });
  } else {
    row = await prisma.qrTemplate.create({
      data: {
        ...data,
        catalogBuiltinId: null,
      },
    });
  }

  const json = rowToJson(row);
  return {
    id: args.catalogBuiltinId ?? json.id,
    dbId: json.id,
    catalogBuiltinId: args.catalogBuiltinId ?? null,
    source: args.catalogBuiltinId ? "builtin" : "catalog",
    hasOverride: Boolean(args.catalogBuiltinId),
    category: json.category,
    kind: json.kind,
    toolKey: json.toolKey,
    title: json.title,
    thumbnailUrl: json.thumbnailUrl,
    promptText: json.reference.prompt.text,
    reference: json.reference,
    sortOrder: json.sortOrder,
    mediaType: inferMediaType(json),
    updatedAt: json.updatedAt,
  };
}

export async function deleteAdminQrTemplate(dbId: string): Promise<void> {
  const row = await prisma.qrTemplate.findFirst({
    where: { id: dbId, deletedAt: null, isPlatformCatalog: true },
  });
  if (!row) throw new Error("仅可删除管理后台维护的模板");
  await prisma.qrTemplate.update({
    where: { id: dbId },
    data: { deletedAt: new Date() },
  });
}
