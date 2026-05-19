/**
 * v004（2026-05-17）：把一次「工具站扣点事件」(ToolUsageEvent) 投影成「云级账单明细行」
 * (ToolBillingDetailLine.cloudRow JSON)，结构与 `tool-web/doc/0516.xlsx` 严格对齐。
 *
 * 设计：cloudRow 是给前端展示与 reconciliation 用的"扁平 key-value 行"，
 * 字段命名与阿里云 consumedetailbill_v2 同套；新增的「平台/*」 8 列是我们自己的"对内 + 对外"信息。
 *
 * cloudRow 写入字段（v004 重构后）：
 *   - 平台 8 列：平台/用户ID + 用户名 + 产品Code + 产品名称 + 计费项Code + 系数(M) + 定价 + 扣点
 *   - 账单信息 6 列（B-G）：account 时间戳
 *   - 产品信息 5 列（H-L）：catalog 命中 → canonical 显示名 / Code；不命中 → toolKeyToLabel 兜底
 *   - 资源信息：留空（TOOL_USAGE_GENERATED 行没有云实例 ID）
 *   - 用量信息 3 列（P/R/S）：actuals 真值（imageCount / videoDurationSec / 1 + 单位）
 *   - 定价信息 4 列：从 snap 投影（官网目录价 = cloudCostUnitYuan、价格单位、阶梯、币种）
 *   - 费用信息 5 列：计费公式 + 目录总价 + 应付（与扣点等价）+ 优惠金额/详情（留空）
 *
 * 已删除写入（v003 兼容包袱清理）：
 *   - "对内计价/*" 6 列（功能改由 DB internal* 列承担、enrich 注入到「平台/系数(M)+定价+扣点」）
 *   - "产品信息/标准模型/档位/选型配置/规格/产品Code" 这些"我们硬造"的中间列（merged 到「平台/产品Code+名称」）
 *   - "标识信息/账单明细ID + 订单号"（reconciliation 仍可通过 ToolBillingDetailLine.id 关联）
 *   - "账单信息/交易类型"、"费用信息/计费规则说明"、"用量信息/用量详情" 等冗余/长文本列。
 */
import type { Prisma } from "@prisma/client";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1 } from "@/lib/finance/pricing-templates/keys";

/**
 * 来自 `resolveBillableSnapshot` 的对内计价快照——记 ToolBillablePrice 命中行的
 * cost/M/我方单价，便于按"行"追溯当时口径。未命中行（如旧路径直接传 costPoints）= 全 null。
 */
export type ToolUsagePricingSnapshot = {
  unitCostYuan: number | null;
  retailMultiplier: number | null;
  ourUnitYuan: number | null;
  schemeARefModelKey: string | null;
  billablePriceId: string | null;
  /** v004：实际计费用量（按秒模型=ceil(durationSec)、按张模型=imageCount、其它=1） */
  billedQty?: number | null;
  /** v004：用量单位（"秒" / "张" / "次" / "千tokens"） */
  billedUnit?: string | null;
  /** v004：cloudBillingKind，决定"价格单位"列展示 */
  cloudBillingKind?: string | null;
};

/**
 * catalog 命中后的"平台标准化 + 厂商映射"信息。
 * - v003：引入 canonicalKey / displayName / vendor，写入「平台/产品Code+名称」
 * - v006 Round 4：扩展 5 个 vendor* 字段，写入「厂商产品/产品名称、商品Code、商品名称、计费项Code、计费项名称」
 *
 * `recordToolUsageAndConsumeWallet` 在事务前 alias 反查得到，传入避免本工厂函数变 async。
 */
export type ToolUsageCanonicalHint = {
  canonicalKey: string;
  displayName: string;
  vendor: string;
  /** 「厂商产品/产品名称」（如 "大模型服务平台百炼"）；catalog.vendorProductName */
  vendorProductName?: string | null;
  /** 「厂商产品/商品Code」（如 "sfm_inference_public_cn"）；catalog.vendorCommodityCode */
  vendorCommodityCode?: string | null;
  /** 「厂商产品/商品名称」（如 "百炼大模型推理"）；catalog.vendorCommodityName */
  vendorCommodityName?: string | null;
  /** 「厂商产品/计费项Code」（如 "image_number"）；catalog.vendorBillableItemCode */
  vendorBillableItemCode?: string | null;
  /** 「厂商产品/计费项名称」（如 "大模型图片生成量"）；catalog.vendorBillableItemName */
  vendorBillableItemName?: string | null;
};

/** v004：用户身份（事务前由 `recordToolUsageAndConsumeWallet` 一次性 SELECT 注入） */
export type ToolUsageUserHint = {
  userId: string;
  userLabel: string;
};

type MetaObject = Record<string, unknown>;

function asObjectOrEmpty(meta: unknown): MetaObject {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as MetaObject;
}

function pickString(meta: MetaObject, key: string): string {
  const v = meta[key];
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function pickNumber(meta: MetaObject, key: string): number | null {
  const v = meta[key];
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** v002：与云 CSV `账单信息/账单月份` 格式一致（YYYYMM），便于 reconcile 直接 join。 */
function fmtYyyyMm(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/** v002：与云 CSV `账单信息/账单日期` 格式一致（YYYYMMDD）。 */
function fmtYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function fmtBeijingIso(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

/** v004：从 cloudBillingKind / 单位 派生"价格单位"列（用于显示） */
function priceUnitFromKind(kind: string | null | undefined, unit: string): string {
  if (!unit) return "";
  return `元/${unit}`;
}

/**
 * 计费公式文案——给"费用信息/计费公式"列展示。
 * 命中 snap 时形如 `官网目录价 × 系数(M) × 用量 = 平台定价 × 用量`；未命中时退化为"按工具扣点"。
 */
function formulaForSnapshot(opts: {
  toolKey: string;
  action: string;
  costPoints: number;
  snap: ToolUsagePricingSnapshot;
  qty: number;
  unit: string;
}): string {
  const cost = opts.snap.unitCostYuan;
  const mult = opts.snap.retailMultiplier;
  const ourUnit = opts.snap.ourUnitYuan;
  if (cost != null && mult != null && ourUnit != null) {
    return (
      `${cost.toFixed(6)} 元/${opts.unit || "次"} × ${mult} × ${opts.qty} ${opts.unit || "次"}` +
      ` = ${ourUnit.toFixed(6)} × ${opts.qty} = ¥${(opts.costPoints / 100).toFixed(2)}`
    );
  }
  return `${opts.toolKey} · ${opts.action} × 1 次 = ${opts.costPoints} 点 (¥${(opts.costPoints / 100).toFixed(2)})`;
}

/**
 * 拼装 cloudRow（v004 重构后的 7 组 + 平台组）。
 *
 * 注意：reconciliation 仍可能扫历史行的旧 keys；我们这里只写**新结构**，旧行被 reset 后整体清掉，
 * 所以不再保留兼容字段。`canonical-bill-overlay.ts` 读侧 fallback 也已同步删除旧 K_CANONICAL/K_TIER。
 */
export function buildCloudRowFromUsage(opts: {
  toolKey: string;
  action: string;
  costPoints: number;
  meta: unknown;
  usageEventId: string;
  createdAt: Date;
  snap?: ToolUsagePricingSnapshot;
  /** v003：catalog 命中信息（来自 ModelAlias 反查） */
  canonical?: ToolUsageCanonicalHint | null;
  /** v004：用户身份 hint（来自事务前 SELECT） */
  userHint?: ToolUsageUserHint | null;
}): Record<string, string> {
  const meta = asObjectOrEmpty(opts.meta);
  const toolLabel = toolKeyToLabel(opts.toolKey);
  const modelKey =
    pickString(meta, "modelId") ||
    pickString(meta, "tryOnModel") ||
    pickString(meta, "videoModel") ||
    pickString(meta, "textToImageModel");
  const apiModel = pickString(meta, "apiModel");
  const taskId = pickString(meta, "taskId");
  const billingRequestId = pickString(meta, "billingRequestId");

  // 平台/产品 标识：catalog 命中优先
  const hasCanonical = Boolean(opts.canonical?.canonicalKey);
  const platformProductCode = hasCanonical ? opts.canonical!.canonicalKey : opts.toolKey;
  const platformProductName = hasCanonical ? opts.canonical!.displayName : toolLabel;
  // v006 Round 4：「平台/计费项Code」改 `toolKey:action` 格式，与 ToolBillablePrice 唯一键对齐
  const platformBillableCode = `${opts.toolKey}:${opts.action}`;

  const snap = opts.snap ?? {
    unitCostYuan: null,
    retailMultiplier: null,
    ourUnitYuan: null,
    schemeARefModelKey: null,
    billablePriceId: null,
    billedQty: null,
    billedUnit: null,
    cloudBillingKind: null,
  };

  // 用量真值——优先 snap.billedQty/billedUnit；其次 meta 推导；最后兜底 1 次
  const metaImageCount = pickNumber(meta, "imageCount");
  const metaVideoSec = pickNumber(meta, "videoDurationSec");
  const billedQty = snap.billedQty ?? metaImageCount ?? metaVideoSec ?? 1;
  const billedUnit =
    snap.billedUnit ??
    (snap.cloudBillingKind === "VIDEO_MODEL_SPEC"
      ? "秒"
      : snap.cloudBillingKind === "OUTPUT_IMAGE" || snap.cloudBillingKind === "COST_PER_IMAGE"
        ? "张"
        : snap.cloudBillingKind === "TOKEN_IN_OUT"
          ? "千tokens"
          : "次");

  const priceUnit = priceUnitFromKind(snap.cloudBillingKind, billedUnit);

  // 「平台/定价」= 我方挂牌单价；「平台/扣点」= 用户钱包实际扣多少点；「平台/系数(M)」= retail 系数
  const platformUnitYuan =
    snap.ourUnitYuan != null
      ? snap.ourUnitYuan.toFixed(6)
      : (opts.costPoints / Math.max(billedQty, 1) / 100).toFixed(6);

  const listPriceYuan = snap.unitCostYuan != null ? snap.unitCostYuan.toFixed(6) : "";
  const listTotalYuan = snap.unitCostYuan != null ? (snap.unitCostYuan * billedQty).toFixed(6) : "0";
  const payableYuan = (opts.costPoints / 100).toFixed(2);

  const formula = formulaForSnapshot({
    toolKey: opts.toolKey,
    action: opts.action,
    costPoints: opts.costPoints,
    snap,
    qty: billedQty,
    unit: billedUnit,
  });

  // 厂商产品 5 列：从 catalog 5 个 vendor* 字段反查填；catalog 未配置 → 留空
  const c = opts.canonical;
  const row: Record<string, string> = {
    // 平台 8 列
    "平台/用户ID": opts.userHint?.userId ?? "",
    "平台/用户名": opts.userHint?.userLabel ?? "",
    "平台/产品Code": platformProductCode,
    "平台/产品名称": platformProductName,
    "平台/计费项Code": platformBillableCode,
    "平台/系数(M)": snap.retailMultiplier != null ? String(snap.retailMultiplier) : "",
    "平台/定价": platformUnitYuan,
    "平台/扣点": String(opts.costPoints),
    // v007 Round 5：「平台/计费公式」（含 ×M 系数，所以是平台计算逻辑）+「平台/应付金额」（用户对平台应付 = 扣点折元）
    "平台/计费公式": formula,
    "平台/应付金额": payableYuan,

    // 平台账单 6 列：我们记录的"用户在工具站调用的时刻"
    "平台账单/账单月份": fmtYyyyMm(opts.createdAt),
    "平台账单/账单日期": fmtYyyyMmDd(opts.createdAt),
    "平台账单/费用类型": "工具站使用费",
    "平台账单/消费时间": fmtBeijingIso(opts.createdAt),
    "平台账单/服务开始时间": fmtBeijingIso(opts.createdAt),
    "平台账单/服务结束时间": fmtBeijingIso(opts.createdAt),

    // 平台用量 3 列：用户本次实际用量
    "平台用量/抵扣前用量": String(billedQty),
    "平台用量/用量": String(billedQty),
    "平台用量/用量单位": billedUnit,

    // 厂商产品 5 列：catalog 命中且配置了 vendor* 字段 → 填；否则留空
    "厂商产品/产品名称": c?.vendorProductName ?? "",
    "厂商产品/商品Code": c?.vendorCommodityCode ?? "",
    "厂商产品/商品名称": c?.vendorCommodityName ?? "",
    "厂商产品/计费项Code": c?.vendorBillableItemCode ?? "",
    "厂商产品/计费项名称": c?.vendorBillableItemName ?? "",

    // 厂商资源 1 列：TOOL_USAGE_GENERATED 行用 taskId / requestId / modelKey 兜底
    "厂商资源/实例ID（出账粒度）": taskId || billingRequestId || modelKey || apiModel || "",

    // 厂商定价 4 列：从 snap 派生；目录价用量阶梯当前一律占位"无阶梯"
    "厂商定价/官网目录价": listPriceYuan,
    "厂商定价/价格单位": priceUnit,
    "厂商定价/目录价用量阶梯": "[0,9999999999999]",
    "厂商定价/定价币种": "CNY",

    // 厂商优惠 2 列：TOOL_USAGE_GENERATED 行无优惠概念——留空（CSV 行才有内容）
    "厂商优惠/优惠金额": "",
    "厂商优惠/优惠详情": "",

    // v007 Round 5 移除（保留代码注释方便审计历史）：
    //   - 厂商费用/计费公式 → 已移到 平台/计费公式（公式含 ×M 系数）
    //   - 厂商费用/目录总价 → 删除（admin 心算可得：厂商定价/官网目录价 × 平台用量/用量）
    //   - 厂商应付/应付金额（含税）→ 已移到 平台/应付金额
  };
  // listTotalYuan 当前未写 cloudRow（已删除"厂商费用/目录总价"列），保留变量便于未来重新引入
  void listTotalYuan;

  return row;
}

/**
 * 生成可直接插入 `prisma.toolBillingDetailLine.createMany` / `.create` 的数据对象。
 *
 * v005（2026-05-17）：`ToolBillingDetailLine.internal*` 7 列已从 schema 移除；
 * 所有"对内计价"信息（云成本单价 / 系数 M / 我方单价 / 实际扣点）都在 cloudRow JSON 内的
 * 「定价/官网目录价 + 平台/系数(M) + 平台/定价 + 平台/扣点」字段里，由 `buildCloudRowFromUsage` 一次性写好。
 *
 * 因此本函数只返回 `{ userId, toolUsageEventId, source, cloudRow, pricingTemplateKey }` 5 字段。
 */
export function buildToolUsageBillingLineData(opts: {
  userId: string;
  toolKey: string;
  action: string;
  costPoints: number;
  meta: unknown;
  usageEventId: string;
  createdAt: Date;
  snap?: ToolUsagePricingSnapshot;
  canonical?: ToolUsageCanonicalHint | null;
  userHint?: ToolUsageUserHint | null;
}): Prisma.ToolBillingDetailLineUncheckedCreateInput {
  const cloudRow = buildCloudRowFromUsage(opts);
  return {
    userId: opts.userId,
    toolUsageEventId: opts.usageEventId,
    source: "TOOL_USAGE_GENERATED",
    cloudRow: cloudRow as unknown as Prisma.InputJsonValue,
    pricingTemplateKey: PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1,
  };
}
