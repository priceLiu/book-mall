import type { PricingBillingKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import {
  buildSourceLineLookup,
  classifyBillableRow,
  formulaTextFor,
  unitLabelFor,
  type SourceLineRef,
} from "@/lib/finance/billable-row-classifier";
import type { PricingRow } from "@/components/pricing/pricing-table";
import {
  AI_TRYON_MODEL_KEYS,
  isAiTryonModelKey,
  REFINER_VOLUME_TIERS,
} from "@/lib/pricing/ai-tryon-cost";

export type EffectiveBillableRow = {
  toolKey: string;
  action: string | null;
  schemeARefModelKey: string | null;
  pricePoints: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;

  /** v005（2026-05-18）：把"云成本/云厂商产品"等列升到公示表 —— 让用户与运营都能看到底层来源 */
  cloudTierRaw: string | null;
  cloudBillingKind: PricingBillingKind | null;
  cloudModelKey: string | null;
  /** 「云厂商挂牌价 (成本价)」，单位与 cloudBillingKind 对应：
   *  - VIDEO_MODEL_SPEC：元/秒
   *  - OUTPUT_IMAGE / COST_PER_IMAGE：元/张
   *  - TOKEN_IN_OUT：元/百万 token（折算 (input + output) / 2）
   */
  schemeAUnitCostYuan: number | null;
  /** 零售系数 M（约定 = 2） */
  retailMultiplier: number | null;

  /** ModelCatalog 同步过来的厂商展示信息 */
  vendorProductName: string | null;
  vendorCommodityName: string | null;
  vendorCommodityCode: string | null;
  vendorBillableItemName: string | null;
  vendorBillableItemCode: string | null;
  modelDisplayName: string | null;
  vendor: string | null;
  unitLabel: string | null;
};

/**
 * 前台公示：财务 2.0 统一积分报价（ModelCreditPrice + ModelCostProfile）。
 */
export async function getEffectiveBillablePricesForDisclosure(
  now = new Date(),
): Promise<EffectiveBillableRow[]> {
  const [prices, profiles, catalogs] = await Promise.all([
    prisma.modelCreditPrice.findMany({ orderBy: { canonicalModelKey: "asc" } }),
    prisma.modelCostProfile.findMany({
      where: {
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
    }),
    prisma.modelCatalog.findMany({
      select: {
        canonicalKey: true,
        displayName: true,
        vendor: true,
        unitLabel: true,
        billingKind: true,
        vendorProductName: true,
        vendorCommodityName: true,
        vendorCommodityCode: true,
        vendorBillableItemName: true,
        vendorBillableItemCode: true,
      },
    }),
  ]);

  const profileByKey = new Map<string, (typeof profiles)[number]>();
  for (const p of profiles) {
    const k = `${p.canonicalModelKey}\0${p.tierRaw ?? ""}`;
    const ex = profileByKey.get(k);
    if (!ex || p.netCostYuan < ex.netCostYuan) profileByKey.set(k, p);
  }
  const cataMap = new Map(catalogs.map((c) => [c.canonicalKey, c]));

  const billingKindFromUnit = (unit: string): PricingBillingKind => {
    if (unit === "PER_SEC") return "VIDEO_MODEL_SPEC";
    if (unit === "PER_IMAGE") return "OUTPUT_IMAGE";
    return "TOKEN_IN_OUT";
  };

  const out: EffectiveBillableRow[] = [];
  for (const price of prices) {
    const prof =
      profileByKey.get(`${price.canonicalModelKey}\0`) ??
      profiles.find((p) => p.canonicalModelKey === price.canonicalModelKey);
    const c = cataMap.get(price.canonicalModelKey);
    const unit = prof?.unit ?? "PER_KTOKEN";
    const netCost = prof ? Number(prof.netCostYuan) : null;
    const listPrice = netCost != null && price.baseMarginRate != null
      ? netCost / (1 - Number(price.baseMarginRate))
      : null;
    const m = netCost != null && listPrice != null && netCost > 0 ? listPrice / netCost : null;

    out.push({
      toolKey: c?.vendor ?? prof?.vendor ?? "platform",
      action: "invoke",
      schemeARefModelKey: price.canonicalModelKey,
      pricePoints: price.creditsPerUnit,
      effectiveFrom: price.publishedAt,
      effectiveTo: null,
      note: "财务2.0 积分报价",
      cloudTierRaw: prof?.tierRaw ?? null,
      cloudBillingKind: c?.billingKind ?? billingKindFromUnit(unit),
      cloudModelKey: price.canonicalModelKey,
      schemeAUnitCostYuan: netCost,
      retailMultiplier: m,
      vendorProductName: c?.vendorProductName ?? null,
      vendorCommodityName: c?.vendorCommodityName ?? null,
      vendorCommodityCode: c?.vendorCommodityCode ?? null,
      vendorBillableItemName: c?.vendorBillableItemName ?? null,
      vendorBillableItemCode: c?.vendorBillableItemCode ?? null,
      modelDisplayName: c?.displayName ?? price.canonicalModelKey,
      vendor: c?.vendor ?? prof?.vendor ?? null,
      unitLabel: c?.unitLabel ?? null,
    });
  }

  return out;
}

/** 「行为」转中文友好文案；与共享组件 PricingRow.actionLabel 对齐。 */
export function actionLabelFor(action: string | null | undefined): string {
  if (action == null || !String(action).trim()) return "未限定行为（通配该工具）";
  const a = String(action).trim();
  if (a === "try_on") return "try_on（如 AI 试衣成片）";
  if (a === "invoke") return "invoke（一次生成任务）";
  return a;
}

/**
 * v005（2026-05-18）整合：把 EffectiveBillableRow 拉直成共享 PricingTable 组件需要的 PricingRow 列表。
 * 价目展示唯一入口为 `/pricing-disclosure`（试衣 #ai-tryon，其余 #all-tools）。
 */
/** 试衣价目排序：基础版 → Plus → 分割 → 精修（七档阶梯按官方表顺序） */
function sortAiTryonDisclosureRows(rows: PricingRow[]): PricingRow[] {
  const modelOrder = new Map(AI_TRYON_MODEL_KEYS.map((k, i) => [k, i]));
  const refinerTierOrder = new Map<string, number>(
    REFINER_VOLUME_TIERS.map((t, i) => [t.tierRaw, i]),
  );
  return [...rows].sort((a, b) => {
    const ma = a.schemeARefModelKey ?? "";
    const mb = b.schemeARefModelKey ?? "";
    const oa = modelOrder.get(ma as (typeof AI_TRYON_MODEL_KEYS)[number]) ?? 99;
    const ob = modelOrder.get(mb as (typeof AI_TRYON_MODEL_KEYS)[number]) ?? 99;
    if (oa !== ob) return oa - ob;
    if (ma === "aitryon-refiner") {
      const ta = refinerTierOrder.get((a.cloudTierRaw ?? "").trim()) ?? 99;
      const tb = refinerTierOrder.get((b.cloudTierRaw ?? "").trim()) ?? 99;
      return ta - tb;
    }
    return (a.cloudTierRaw ?? "").localeCompare(b.cloudTierRaw ?? "", "zh-CN");
  });
}

/** 试衣四模型完整价目（公示锚点 #ai-tryon；含 refiner 全部阶梯行） */
export async function getAiTryonPricingTableRowsForDisclosure(
  now = new Date(),
): Promise<PricingRow[]> {
  const rows = await getPricingTableRowsForDisclosure(now);
  return sortAiTryonDisclosureRows(
    rows.filter((r) => isAiTryonModelKey(r.schemeARefModelKey)),
  );
}

/** 全工具价目（不含 AI 试衣四模型；试衣见 {@link getAiTryonPricingTableRowsForDisclosure} / #ai-tryon） */
export async function getNonAiTryonPricingTableRowsForDisclosure(
  now = new Date(),
): Promise<PricingRow[]> {
  const rows = await getPricingTableRowsForDisclosure(now);
  return rows.filter((r) => !isAiTryonModelKey(r.schemeARefModelKey));
}

export async function getPricingTableRowsForDisclosure(now = new Date()): Promise<PricingRow[]> {
  const [billable, currentVersion] = await Promise.all([
    getEffectiveBillablePricesForDisclosure(now),
    prisma.pricingSourceVersion.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    }),
  ]);
  const sourceLines = currentVersion
    ? await prisma.pricingSourceLine.findMany({
        where: { versionId: currentVersion.id },
        select: { modelKey: true, tierRaw: true, billingKind: true },
      })
    : ([] as SourceLineRef[]);
  const lookup = buildSourceLineLookup(sourceLines as SourceLineRef[]);

  return billable.map((r, idx): PricingRow => {
    const cls = classifyBillableRow(
      {
        toolKey: r.toolKey,
        schemeARefModelKey: r.schemeARefModelKey,
        cloudModelKey: r.cloudModelKey,
        cloudTierRaw: r.cloudTierRaw,
        cloudBillingKind: r.cloudBillingKind,
      },
      lookup,
    );
    return {
      id: `${r.toolKey}\0${r.action ?? ""}\0${r.schemeARefModelKey ?? ""}\0${r.cloudTierRaw ?? ""}\0${idx}`,
      toolKey: r.toolKey,
      toolLabel: toolKeyToLabel(r.toolKey),
      action: r.action,
      actionLabel: actionLabelFor(r.action),
      schemeARefModelKey: r.schemeARefModelKey,
      cloudTierRaw: cls.tierRaw,
      cloudBillingKind: cls.billingKind,
      unitLabel: unitLabelFor(cls.billingKind, cls.tierRaw),
      formulaText: formulaTextFor(cls.billingKind),
      pricePoints: r.pricePoints,
      schemeAUnitCostYuan: r.schemeAUnitCostYuan,
      retailMultiplier: r.retailMultiplier,
      vendorProductName: r.vendorProductName,
      vendorCommodityName: r.vendorCommodityName,
      modelDisplayName: r.modelDisplayName,
      vendor: r.vendor,
    };
  });
}

/**
 * 把 cloudBillingKind + cloudTierRaw 翻译为给用户看的"单价单位"。
 * 例：VIDEO_MODEL_SPEC 1080P|audio → "元 / 秒（1080P · 含音频）"
 */
export function describeUnitForDisclosure(
  billingKind: PricingBillingKind | null,
  tierRaw: string | null,
): string {
  if (!billingKind) return "—";
  const tier = (tierRaw ?? "").trim();
  if (billingKind === "VIDEO_MODEL_SPEC") {
    if (!tier) return "元 / 秒";
    const m = tier.match(/^(\d{3,4}P)(?:\|(audio|silent))?$/i);
    if (m) {
      const sr = m[1]!;
      const audio = m[2];
      if (!audio) return `元 / 秒（${sr}）`;
      return audio === "audio" ? `元 / 秒（${sr} · 含音频）` : `元 / 秒（${sr} · 静音）`;
    }
    return `元 / 秒（${tier}）`;
  }
  if (billingKind === "OUTPUT_IMAGE" || billingKind === "COST_PER_IMAGE") {
    return tier ? `元 / 张（${tier}）` : "元 / 张";
  }
  if (billingKind === "TOKEN_IN_OUT") {
    return tier ? `元 / 百万 token（${tier}）` : "元 / 百万 token";
  }
  return "—";
}
