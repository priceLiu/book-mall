import { prisma } from "@/lib/prisma";
import {
  getBuiltinQrTemplateById,
  listBuiltinQrTemplates,
} from "@/lib/quick-replica/builtin-templates";
import { filterBuiltinsForKindBrowse } from "@/lib/quick-replica/qr-template-catalog";
import { getKindDef, getKindsForCategory } from "@/lib/quick-replica/qr-kinds";
import type { QrCategory, QrKindBrowseItem, QrTemplateJson } from "@/lib/quick-replica/qr-types";
import {
  applyCatalogOverridesToBuiltin,
  loadCatalogOverrideMap,
} from "@/lib/quick-replica/qr-template-admin-service";
import { rowToJson } from "@/lib/quick-replica/qr-template-service";

type QrTemplateRow = Parameters<typeof rowToJson>[0];

function firstTemplateByKind(rows: QrTemplateRow[]): Map<string, QrTemplateJson> {
  const map = new Map<string, QrTemplateJson>();
  for (const row of rows) {
    if (!map.has(row.kind)) map.set(row.kind, rowToJson(row));
  }
  return map;
}

function resolveFeaturedFromMaps(args: {
  kind: string;
  featuredRow: { templateId: string; templateSource: string } | undefined;
  userFeaturedById: Map<string, QrTemplateJson>;
  builtinByKind: Map<string, QrTemplateJson>;
  publicByKind: Map<string, QrTemplateJson>;
  ownByKind: Map<string, QrTemplateJson>;
  overrideMap: Map<string, QrTemplateJson>;
}): QrTemplateJson | null {
  const row = args.featuredRow;
  if (row) {
    if (row.templateSource === "builtin") {
      const builtin = getBuiltinQrTemplateById(row.templateId);
      if (!builtin) return null;
      return args.overrideMap.get(builtin.id) ?? builtin;
    }
    return args.userFeaturedById.get(row.templateId) ?? null;
  }
  return (
    args.builtinByKind.get(args.kind) ??
    args.publicByKind.get(args.kind) ??
    args.ownByKind.get(args.kind) ??
    null
  );
}

export async function resolveFeaturedTemplate(args: {
  kind: string;
  userId: string;
}): Promise<QrTemplateJson | null> {
  const overrideMap = await loadCatalogOverrideMap();
  const featured = await prisma.qrKindFeatured.findUnique({
    where: { kind: args.kind },
  });
  if (featured) {
    if (featured.templateSource === "builtin") {
      const builtin = getBuiltinQrTemplateById(featured.templateId);
      if (builtin) return overrideMap.get(builtin.id) ?? builtin;
    } else {
      const row = await prisma.qrTemplate.findFirst({
        where: { id: featured.templateId, deletedAt: null },
      });
      if (row) return rowToJson(row);
    }
  }

  const builtinRaw = filterBuiltinsForKindBrowse(
    listBuiltinQrTemplates({ kind: args.kind }),
  )[0];
  if (builtinRaw) {
    return applyCatalogOverridesToBuiltin([builtinRaw], overrideMap)[0] ?? null;
  }

  const publicRow = await prisma.qrTemplate.findFirst({
    where: { kind: args.kind, visibility: "public", deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  if (publicRow) return rowToJson(publicRow);

  const ownRow = await prisma.qrTemplate.findFirst({
    where: { kind: args.kind, ownerUserId: args.userId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return ownRow ? rowToJson(ownRow) : null;
}

export async function listKindBrowseItems(
  userId: string,
  category: QrCategory,
): Promise<QrKindBrowseItem[]> {
  const defs = getKindsForCategory(category);
  const kindIds = defs.map((d) => d.id);
  if (kindIds.length === 0) return [];

  const overrideMap = await loadCatalogOverrideMap();

  const featuredRows = await prisma.qrKindFeatured.findMany({
    where: { kind: { in: kindIds } },
  });
  const featuredMap = new Map(featuredRows.map((r) => [r.kind, r]));

  const userFeaturedIds = featuredRows
    .filter((r) => r.templateSource === "user")
    .map((r) => r.templateId);

  const [userFeaturedRows, publicRows, ownRows] = await Promise.all([
    userFeaturedIds.length
      ? prisma.qrTemplate.findMany({
          where: { id: { in: userFeaturedIds }, deletedAt: null },
        })
      : Promise.resolve([]),
    prisma.qrTemplate.findMany({
      where: { kind: { in: kindIds }, visibility: "public", deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.qrTemplate.findMany({
      where: { kind: { in: kindIds }, ownerUserId: userId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const userFeaturedById = new Map(userFeaturedRows.map((r) => [r.id, rowToJson(r)]));
  const publicByKind = firstTemplateByKind(publicRows);
  const ownByKind = firstTemplateByKind(ownRows);
  const builtinByKind = new Map<string, QrTemplateJson>();
  for (const t of applyCatalogOverridesToBuiltin(
    filterBuiltinsForKindBrowse(listBuiltinQrTemplates({ category })),
    overrideMap,
  )) {
    if (!kindIds.includes(t.kind)) continue;
    if (!builtinByKind.has(t.kind)) builtinByKind.set(t.kind, t);
  }

  return defs.map((def) => ({
    kind: def.id,
    label: def.label,
    labelEn: def.labelEn,
    description: def.description,
    toolKey: def.toolKey,
    featuredTemplate: resolveFeaturedFromMaps({
      kind: def.id,
      featuredRow: featuredMap.get(def.id),
      userFeaturedById,
      builtinByKind,
      publicByKind,
      ownByKind,
      overrideMap,
    }),
  }));
}

export async function setKindFeaturedTemplate(args: {
  kind: string;
  templateId: string;
  templateSource: "builtin" | "user";
  adminUserId: string;
  makePublic?: boolean;
}) {
  if (!getKindDef(args.kind)) {
    throw new Error(`未知 kind: ${args.kind}`);
  }
  if (args.templateSource === "builtin") {
    if (!getBuiltinQrTemplateById(args.templateId)) {
      throw new Error("内置模板不存在");
    }
  } else {
    const row = await prisma.qrTemplate.findFirst({
      where: { id: args.templateId, deletedAt: null },
    });
    if (!row) throw new Error("用户模板不存在");
    if (args.makePublic) {
      await prisma.qrTemplate.update({
        where: { id: args.templateId },
        data: { visibility: "public" },
      });
    }
  }

  return prisma.qrKindFeatured.upsert({
    where: { kind: args.kind },
    create: {
      kind: args.kind,
      templateId: args.templateId,
      templateSource: args.templateSource,
      updatedByUserId: args.adminUserId,
    },
    update: {
      templateId: args.templateId,
      templateSource: args.templateSource,
      updatedByUserId: args.adminUserId,
    },
  });
}

export async function clearKindFeatured(kind: string) {
  await prisma.qrKindFeatured.deleteMany({ where: { kind } });
}
