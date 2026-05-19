import { AliasConfidence, ModelAliasSource, PricingBillingKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * v003 单个录入：在校准页一次性新建（或更新）一个 ModelCatalog，并挂载 N 条 ModelAlias。
 * 设计目标——用户要求"支持单个模型的导入或输入"：表单填 canonicalKey + displayName + vendor + billingKind + 别名数组，
 * 后端 upsert 后无须再次去待审区操作。
 */
export type UpsertModelCatalogInput = {
  canonicalKey: string;
  displayName: string;
  vendor: string;
  billingKind: PricingBillingKind;
  unitLabel: string;
  defaultTierRaw?: string | null;
  note?: string | null;
  active?: boolean;
  aliases: Array<{
    source: ModelAliasSource;
    aliasValue: string;
    tierRawHint?: string | null;
  }>;
};

export async function upsertModelCatalogWithAliases(input: UpsertModelCatalogInput): Promise<{
  catalogId: string;
  created: boolean;
  attachedAliases: number;
}> {
  const canonicalKey = input.canonicalKey.trim();
  if (!canonicalKey) throw new Error("canonicalKey 不能为空");
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("displayName 不能为空");
  const vendor = input.vendor.trim();
  if (!vendor) throw new Error("vendor 不能为空");
  const unitLabel = input.unitLabel.trim();
  if (!unitLabel) throw new Error("unitLabel 不能为空");

  return prisma.$transaction(async (tx) => {
    const before = await tx.modelCatalog.findUnique({
      where: { canonicalKey },
      select: { id: true },
    });
    const catalog = await tx.modelCatalog.upsert({
      where: { canonicalKey },
      create: {
        canonicalKey,
        displayName,
        vendor,
        billingKind: input.billingKind,
        unitLabel,
        defaultTierRaw: input.defaultTierRaw ?? null,
        note: input.note ?? null,
        active: input.active ?? true,
      },
      update: {
        displayName,
        vendor,
        billingKind: input.billingKind,
        unitLabel,
        defaultTierRaw: input.defaultTierRaw ?? null,
        note: input.note ?? null,
        active: input.active ?? true,
      },
      select: { id: true },
    });

    let attached = 0;
    for (const a of input.aliases) {
      const v = a.aliasValue.trim();
      if (!v) continue;
      // 不冲掉已绑到其他 catalog 的别名：仅在"无主"或"已绑到本 catalog"时挂载。
      const existing = await tx.modelAlias.findUnique({
        where: { source_aliasValue: { source: a.source, aliasValue: v } },
        select: { id: true, catalogId: true },
      });
      if (existing && existing.catalogId && existing.catalogId !== catalog.id) {
        // 冲突：跳过（前端可在"待审"页解挂后重试）
        continue;
      }
      if (existing) {
        // 已存在的别名：仅在传入了 tierRawHint 时更新该字段，避免误清空既有值
        const tierUpdate =
          a.tierRawHint !== undefined && a.tierRawHint !== null
            ? { tierRawHint: a.tierRawHint }
            : {};
        await tx.modelAlias.update({
          where: { id: existing.id },
          data: {
            catalogId: catalog.id,
            confidence: AliasConfidence.MANUAL,
            matchedBy: "manual",
            ...tierUpdate,
          },
        });
      } else {
        await tx.modelAlias.create({
          data: {
            catalogId: catalog.id,
            source: a.source,
            aliasValue: v,
            tierRawHint: a.tierRawHint ?? null,
            confidence: AliasConfidence.MANUAL,
            matchedBy: "manual",
          },
        });
      }
      attached++;
    }

    return { catalogId: catalog.id, created: !before, attachedAliases: attached };
  });
}

/** 把一个待审 alias 挂到指定 catalog（"接受建议"或"改挂"）。 */
export async function setAliasCatalog(input: {
  aliasId: string;
  catalogId: string;
  reason?: string;
}): Promise<{ ok: true }> {
  await prisma.modelAlias.update({
    where: { id: input.aliasId },
    data: {
      catalogId: input.catalogId,
      confidence: AliasConfidence.MANUAL,
      matchedBy: "manual",
    },
  });
  return { ok: true };
}

/** 解挂：把 alias 重置回 pending（catalogId=null）。 */
export async function detachAlias(input: { aliasId: string }): Promise<{ ok: true }> {
  await prisma.modelAlias.update({
    where: { id: input.aliasId },
    data: { catalogId: null, confidence: AliasConfidence.LOW, matchedBy: null },
  });
  return { ok: true };
}
