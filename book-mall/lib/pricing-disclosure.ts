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
 * 前台公示：当前仍处于生效区间内的按次标价。
 *
 * v005（2026-05-18）变更：
 *  - 不再按 (toolKey, action, schemeARefModelKey) 去重，而是按 (toolKey, action, schemeARefModelKey, cloudTierRaw) 去重，
 *    这样同一模型的 720P / 1080P / audio / silent 等档位在公示表中各占一行，符合云厂商挂牌的颗粒度。
 *  - join ModelCatalog（按 canonicalKey = ToolBillablePrice.cloudModelKey ?? schemeARefModelKey）
 *    把"厂商产品名 / 商品名 / 计费项"等带出去，让用户看到底层成本来源。
 */
export async function getEffectiveBillablePricesForDisclosure(
  now = new Date(),
): Promise<EffectiveBillableRow[]> {
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [
      { toolKey: "asc" },
      { action: "asc" },
      { schemeARefModelKey: "asc" },
      { cloudTierRaw: "asc" },
      { effectiveFrom: "desc" },
      { updatedAt: "desc" },
    ],
  });

  const seen = new Set<string>();
  const dedup: typeof rows = [];
  for (const r of rows) {
    const k = `${r.toolKey}\0${r.action ?? ""}\0${r.schemeARefModelKey ?? ""}\0${r.cloudTierRaw ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(r);
  }

  // 一次性批量查 ModelCatalog
  const canonicalKeys = Array.from(
    new Set(
      dedup
        .map((r) => r.cloudModelKey ?? r.schemeARefModelKey ?? null)
        .filter((s): s is string => !!s && s.trim() !== ""),
    ),
  );
  const catalogs =
    canonicalKeys.length === 0
      ? []
      : await prisma.modelCatalog.findMany({
          where: { canonicalKey: { in: canonicalKeys } },
          select: {
            canonicalKey: true,
            displayName: true,
            vendor: true,
            unitLabel: true,
            vendorProductName: true,
            vendorCommodityName: true,
            vendorCommodityCode: true,
            vendorBillableItemName: true,
            vendorBillableItemCode: true,
          },
        });
  const cataMap = new Map(catalogs.map((c) => [c.canonicalKey, c]));

  const out: EffectiveBillableRow[] = dedup.map((r) => {
    const catKey = r.cloudModelKey ?? r.schemeARefModelKey ?? "";
    const c = catKey ? cataMap.get(catKey) : undefined;
    return {
      toolKey: r.toolKey,
      action: r.action,
      schemeARefModelKey: r.schemeARefModelKey ?? null,
      pricePoints: r.pricePoints,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      note: r.note,
      cloudTierRaw: r.cloudTierRaw ?? null,
      cloudBillingKind: r.cloudBillingKind ?? null,
      cloudModelKey: r.cloudModelKey ?? null,
      schemeAUnitCostYuan: r.schemeAUnitCostYuan ?? null,
      retailMultiplier: r.schemeAAdminRetailMultiplier ?? null,
      vendorProductName: c?.vendorProductName ?? null,
      vendorCommodityName: c?.vendorCommodityName ?? null,
      vendorCommodityCode: c?.vendorCommodityCode ?? null,
      vendorBillableItemName: c?.vendorBillableItemName ?? null,
      vendorBillableItemCode: c?.vendorBillableItemCode ?? null,
      modelDisplayName: c?.displayName ?? null,
      vendor: c?.vendor ?? null,
      unitLabel: c?.unitLabel ?? null,
    };
  });

  out.sort((a, b) => {
    const tk = a.toolKey.localeCompare(b.toolKey, "zh-CN");
    if (tk !== 0) return tk;
    if (a.action == null && b.action != null) return 1;
    if (a.action != null && b.action == null) return -1;
    const ac = (a.action ?? "").localeCompare(b.action ?? "", "zh-CN");
    if (ac !== 0) return ac;
    const mk = (a.schemeARefModelKey ?? "").localeCompare(
      b.schemeARefModelKey ?? "",
      "zh-CN",
    );
    if (mk !== 0) return mk;
    return (a.cloudTierRaw ?? "").localeCompare(b.cloudTierRaw ?? "", "zh-CN");
  });

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
 * `/account/pricing` 与 `/pricing-disclosure` 都以这个函数为唯一入口，避免再出现"两个表两套口径"。
 */
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
