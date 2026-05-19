import type { ModelAliasSource, AliasConfidence, PricingBillingKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ModelCatalogRow = {
  id: string;
  canonicalKey: string;
  displayName: string;
  vendor: string;
  defaultTierRaw: string | null;
  billingKind: PricingBillingKind;
  unitLabel: string;
  active: boolean;
  note: string | null;
  aliases: Array<{
    id: string;
    source: ModelAliasSource;
    aliasValue: string;
    tierRawHint: string | null;
    confidence: AliasConfidence;
    matchedBy: string | null;
  }>;
};

export async function listModelCatalogs(): Promise<ModelCatalogRow[]> {
  const rows = await prisma.modelCatalog.findMany({
    orderBy: [{ vendor: "asc" }, { canonicalKey: "asc" }],
    include: {
      aliases: {
        where: { active: true },
        orderBy: [{ source: "asc" }, { aliasValue: "asc" }],
        select: {
          id: true,
          source: true,
          aliasValue: true,
          tierRawHint: true,
          confidence: true,
          matchedBy: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    canonicalKey: r.canonicalKey,
    displayName: r.displayName,
    vendor: r.vendor,
    defaultTierRaw: r.defaultTierRaw,
    billingKind: r.billingKind,
    unitLabel: r.unitLabel,
    active: r.active,
    note: r.note,
    aliases: r.aliases,
  }));
}

export type PendingAliasRow = {
  id: string;
  source: ModelAliasSource;
  aliasValue: string;
  tierRawHint: string | null;
  confidence: AliasConfidence;
  matchedBy: string | null;
  createdAt: Date;
};

export async function listPendingAliases(): Promise<PendingAliasRow[]> {
  return prisma.modelAlias.findMany({
    where: { catalogId: null, active: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      source: true,
      aliasValue: true,
      tierRawHint: true,
      confidence: true,
      matchedBy: true,
      createdAt: true,
    },
  });
}

export type CalibrationKpi = {
  catalogs: number;
  aliases: number;
  pending: number;
  highConfidence: number;
};

export async function calibrationKpi(): Promise<CalibrationKpi> {
  const [catalogs, aliases, pending, highConfidence] = await Promise.all([
    prisma.modelCatalog.count({ where: { active: true } }),
    prisma.modelAlias.count({ where: { active: true } }),
    prisma.modelAlias.count({ where: { active: true, catalogId: null } }),
    prisma.modelAlias.count({ where: { active: true, confidence: "HIGH" } }),
  ]);
  return { catalogs, aliases, pending, highConfidence };
}
