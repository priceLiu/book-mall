/**
 * v003 自动校准（auto-calibrate）：让运营**不用手动建一行 catalog**。
 *
 * 工作流（3 步，从可信度高到低）：
 *
 *   1) seedCatalogsFromToolBillablePrices  ：从已有 `ToolBillablePrice` 派生 ModelCatalog
 *      （schemeARefModelKey 是我们 admin 已经"认定"过的模型 id；最权威）
 *   2) seedCatalogsFromPricingSourceLines  ：从 `PricingSourceLine` 派生（云成本真源；广覆盖）
 *   3) autoBindPendingAliases              ：扫所有 `catalogId IS NULL` 的 ModelAlias，
 *      跑一遍 `suggestAliasMatches`，把 HIGH/MEDIUM 自动绑定上 catalogId（LOW 留待审）
 *
 * 适合两种触发：
 *   - 校准页"一键自动校准"按钮
 *   - 每次 CSV 导入对账后自动触发（runReconciliationFromCsv 内）
 */
import { AliasConfidence, ModelAliasSource, type PricingBillingKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { suggestAliasMatches } from "./suggest";

export type AutoCalibrateResult = {
  catalogsCreatedFromBillablePrices: number;
  catalogsCreatedFromPricingSourceLines: number;
  aliasesAttachedHigh: number;
  aliasesAttachedMedium: number;
  pendingLow: number;
};

const UNIT_LABEL_BY_KIND: Record<PricingBillingKind, string> = {
  TOKEN_IN_OUT: "元/百万 tokens",
  OUTPUT_IMAGE: "元/张",
  COST_PER_IMAGE: "元/张",
  VIDEO_MODEL_SPEC: "元/秒",
};

/** toolKey 推断 vendor；后续若有第二家厂商再做精确扩展。 */
function vendorFromToolKey(toolKey: string): string {
  const k = toolKey.toLowerCase();
  // 当前所有视频/图像/试衣工具都接通义/百炼（阿里云）；analyze 等也走百炼 OpenAI 兼容口径。
  if (
    k.startsWith("image-to-video") ||
    k.startsWith("text-to-image") ||
    k.startsWith("text-to-video") ||
    k.startsWith("fitting-room") ||
    k.startsWith("visual-lab")
  ) {
    return "aliyun";
  }
  return "aliyun";
}

function displayNameFromCanonical(canonicalKey: string, toolKey: string): string {
  const label = toolKeyToLabel(toolKey);
  if (label && label !== "—" && !canonicalKey.includes(label)) {
    return `${canonicalKey} · ${label}`;
  }
  return canonicalKey;
}

/**
 * Phase 1：从 `ToolBillablePrice` 派生 ModelCatalog。
 * 优先级最高——schemeARefModelKey 是 admin 在「按次单价」页面亲手配置过的内部标准 id。
 * 同时把 (INTERNAL_SCHEME_A_MODEL, schemeARefModelKey) 别名挂上去；若已存在则更新绑定。
 */
async function seedCatalogsFromToolBillablePrices(): Promise<{
  created: number;
  aliasAttached: number;
}> {
  // 财务 2.0：ToolBillablePrice 已退役，目录种子改由 PricingSourceLine / ModelCostProfile 驱动。
  return { created: 0, aliasAttached: 0 };
}

/**
 * Phase 2：从 `PricingSourceLine` 派生 ModelCatalog（云厂商成本真源）。
 * 取最新一个 ACTIVE/READY 版本的全部行；canonicalKey 用 modelKey；
 * 别名挂 (VENDOR_RESOURCE_SPEC, modelKey)。
 */
async function seedCatalogsFromPricingSourceLines(): Promise<{
  created: number;
  aliasAttached: number;
}> {
  // 优先取标记 isCurrent 的版本；否则退回到最近一次导入。
  const latestVersion =
    (await prisma.pricingSourceVersion.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    })) ??
    (await prisma.pricingSourceVersion.findFirst({
      orderBy: { importedAt: "desc" },
      select: { id: true },
    }));
  if (!latestVersion) return { created: 0, aliasAttached: 0 };

  const lines = await prisma.pricingSourceLine.findMany({
    where: { versionId: latestVersion.id },
    select: {
      modelKey: true,
      billingKind: true,
      tierRaw: true,
    },
  });

  let created = 0;
  let aliasAttached = 0;
  const seen = new Set<string>();
  for (const l of lines) {
    const canonicalKey = l.modelKey?.trim();
    if (!canonicalKey) continue;
    if (seen.has(canonicalKey)) continue;
    seen.add(canonicalKey);

    const existing = await prisma.modelCatalog.findUnique({
      where: { canonicalKey },
      select: { id: true },
    });
    let catalogId: string;
    if (existing) {
      catalogId = existing.id;
    } else {
      const fresh = await prisma.modelCatalog.create({
        data: {
          canonicalKey,
          displayName: canonicalKey,
          vendor: "aliyun",
          billingKind: l.billingKind,
          unitLabel: UNIT_LABEL_BY_KIND[l.billingKind],
          defaultTierRaw: l.tierRaw && l.tierRaw !== "-" ? l.tierRaw : null,
          active: true,
        },
        select: { id: true },
      });
      catalogId = fresh.id;
      created++;
    }

    const aliasExisting = await prisma.modelAlias.findUnique({
      where: {
        source_aliasValue: {
          source: ModelAliasSource.VENDOR_RESOURCE_SPEC,
          aliasValue: canonicalKey,
        },
      },
      select: { id: true, catalogId: true },
    });
    if (!aliasExisting) {
      await prisma.modelAlias.create({
        data: {
          source: ModelAliasSource.VENDOR_RESOURCE_SPEC,
          aliasValue: canonicalKey,
          catalogId,
          confidence: AliasConfidence.HIGH,
          matchedBy: "seed:pricing_source_line",
        },
      });
      aliasAttached++;
    } else if (!aliasExisting.catalogId) {
      await prisma.modelAlias.update({
        where: { id: aliasExisting.id },
        data: {
          catalogId,
          confidence: AliasConfidence.HIGH,
          matchedBy: "seed:pricing_source_line",
        },
      });
      aliasAttached++;
    }
  }

  return { created, aliasAttached };
}

/**
 * Phase 3：把所有 `catalogId IS NULL` 的 alias 重新跑一遍 suggest，
 * HIGH/MEDIUM 命中的自动绑定（LOW 留待审）。
 */
async function autoBindPendingAliases(): Promise<{ high: number; medium: number; low: number }> {
  const pending = await prisma.modelAlias.findMany({
    where: { catalogId: null, active: true },
    select: { id: true, source: true, aliasValue: true, tierRawHint: true },
  });
  if (pending.length === 0) return { high: 0, medium: 0, low: 0 };

  const suggestions = await suggestAliasMatches(
    pending.map((p) => ({
      source: p.source,
      aliasValue: p.aliasValue,
      tierRawHint: p.tierRawHint ?? null,
    })),
  );

  let high = 0;
  let medium = 0;
  let low = 0;
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]!;
    const s = suggestions[i]!;
    if (!s.suggested) {
      low++;
      continue;
    }
    const confidence = s.suggested.confidence;
    if (confidence === AliasConfidence.HIGH || confidence === AliasConfidence.MEDIUM) {
      await prisma.modelAlias.update({
        where: { id: p.id },
        data: {
          catalogId: s.suggested.catalogId,
          confidence,
          matchedBy: `auto:${s.suggested.matchedBy}`,
        },
      });
      if (confidence === AliasConfidence.HIGH) high++;
      else medium++;
    } else {
      // LOW: 维持 pending，仅刷新 confidence 字段
      await prisma.modelAlias.update({
        where: { id: p.id },
        data: { confidence, matchedBy: s.suggested.matchedBy },
      });
      low++;
    }
  }
  return { high, medium, low };
}

/**
 * 一键自动校准：1) seed from ToolBillablePrice → 2) seed from PricingSourceLine → 3) auto-bind pending。
 * 返回各阶段的计数，便于 UI 显示。
 */
export async function runFullAutoCalibration(): Promise<AutoCalibrateResult> {
  const fromPrices = await seedCatalogsFromToolBillablePrices();
  const fromSrc = await seedCatalogsFromPricingSourceLines();
  const bind = await autoBindPendingAliases();
  return {
    catalogsCreatedFromBillablePrices: fromPrices.created,
    catalogsCreatedFromPricingSourceLines: fromSrc.created,
    aliasesAttachedHigh: bind.high + fromPrices.aliasAttached + fromSrc.aliasAttached,
    aliasesAttachedMedium: bind.medium,
    pendingLow: bind.low,
  };
}

export { autoBindPendingAliases };
