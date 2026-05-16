/**
 * 把一次「工具站扣点事件」(ToolUsageEvent) 投影成「云级账单明细行」(ToolBillingDetailLine)。
 *
 * 设计目标：
 * - 财务控制台「账单详情」的**主数据**是用户实际产生的扣点流水；
 * - 与云厂商 CSV 行（同表）共存且字段语义对齐，便于后续对账；
 * - 计价模板用 `internal.tool_usage_v1`，UI 中的「平台信息/计价模板」一列即标记来源。
 */
import { Prisma } from "@prisma/client";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1 } from "@/lib/finance/pricing-templates/keys";

/**
 * v002 引入：写明细行时一并固化「云成本单价 / 零售系数 / 我方单价 / 命中行 id / 公式」。
 * 由 `resolveBillableSnapshot` 提供，未命中行（如 body.costPoints 直接传值）则全部 null。
 */
export type ToolUsagePricingSnapshot = {
  unitCostYuan: number | null;
  retailMultiplier: number | null;
  ourUnitYuan: number | null;
  schemeARefModelKey: string | null;
  billablePriceId: string | null;
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

function formulaForSnapshot(opts: {
  toolKey: string;
  action: string;
  costPoints: number;
  snap: ToolUsagePricingSnapshot;
  modelKey: string;
}): string {
  const yuan = opts.costPoints / 100;
  const cost = opts.snap.unitCostYuan;
  const mult = opts.snap.retailMultiplier;
  const ourUnit = opts.snap.ourUnitYuan;
  const modelSeg = opts.modelKey ? ` · model=${opts.modelKey}` : "";

  if (cost != null && mult != null && ourUnit != null) {
    return (
      `云成本单价=${cost.toFixed(6)} 元/次；系数=${mult}；` +
      `我方单价=${ourUnit.toFixed(6)} 元/次=cost×M；` +
      `用量=1 次；本行扣点=${opts.costPoints}（折元 ¥${yuan.toFixed(2)}）；` +
      `工具=${opts.toolKey} · 计费项=${opts.action}${modelSeg}；` +
      `模板=工具站使用 · 按公式快照`
    );
  }
  return (
    `工具 ${opts.toolKey} · ${opts.action} · 扣点=${opts.costPoints} ` +
    `(折元 ¥${yuan.toFixed(2)}；1 点 = ¥0.01)；` +
    `缺少 cost/系数快照（命中行未填 schemeAUnitCostYuan 或 schemeAAdminRetailMultiplier）；` +
    `模板=工具站使用 · 按公式快照`
  );
}

/**
 * 拼装 cloudRow：使用与 `lib/finance/bill-display-keys.ts` 同套中文 key，
 * 让 finance-web 的同一套表头与筛选直接生效。
 * v002：把对内计价四列写进 cloudRow，回放（compute）与读接口都能拿到。
 */
export function buildCloudRowFromUsage(opts: {
  toolKey: string;
  action: string;
  costPoints: number;
  meta: unknown;
  usageEventId: string;
  createdAt: Date;
  snap?: ToolUsagePricingSnapshot;
}): Record<string, string> {
  const meta = asObjectOrEmpty(opts.meta);
  const yuan = opts.costPoints / 100;
  const productLabel = toolKeyToLabel(opts.toolKey);
  const modelKey =
    pickString(meta, "modelId") ||
    pickString(meta, "tryOnModel") ||
    pickString(meta, "videoModel") ||
    pickString(meta, "textToImageModel");
  const apiModel = pickString(meta, "apiModel");
  const taskId = pickString(meta, "taskId");
  const billingRequestId = pickString(meta, "billingRequestId");
  const videoDurationSec = pickString(meta, "videoDurationSec");
  const imageCount = pickString(meta, "imageCount");

  const selectionParts: string[] = [];
  if (modelKey) selectionParts.push(`model=${modelKey}`);
  if (apiModel) selectionParts.push(`apiModel=${apiModel}`);
  if (videoDurationSec) selectionParts.push(`videoDurationSec=${videoDurationSec}`);
  if (imageCount) selectionParts.push(`imageCount=${imageCount}`);
  const selection = selectionParts.join(" / ");

  const snap = opts.snap ?? {
    unitCostYuan: null,
    retailMultiplier: null,
    ourUnitYuan: null,
    schemeARefModelKey: null,
    billablePriceId: null,
  };
  const formula = formulaForSnapshot({
    toolKey: opts.toolKey,
    action: opts.action,
    costPoints: opts.costPoints,
    snap,
    modelKey: modelKey || apiModel,
  });

  const row: Record<string, string> = {
    "账单信息/账单月份": fmtYyyyMm(opts.createdAt),
    "账单信息/账单日期": fmtYyyyMmDd(opts.createdAt),
    "账单信息/费用类型": "工具站使用费",
    "账单信息/交易类型": "按量付费",
    "账单信息/消费时间": fmtBeijingIso(opts.createdAt),
    "产品信息/产品Code": opts.toolKey,
    "产品信息/产品名称": productLabel,
    "产品信息/商品Code": opts.toolKey,
    "产品信息/商品名称": productLabel,
    "产品信息/计费项Code": opts.action,
    "产品信息/计费项名称": opts.action,
    "产品信息/选型配置": selection,
    "产品信息/规格": modelKey || apiModel || "",
    "用量信息/用量": "1",
    "用量信息/用量单位": "次",
    "用量信息/用量详情": selection,
    "应付信息/应付金额（含税）": yuan.toFixed(2),
    "费用信息/计费规则说明": `工具站扣点 ${opts.costPoints} 点 ≈ ¥${yuan.toFixed(2)}（1 点 = ¥0.01）`,
    "标识信息/账单明细ID": opts.usageEventId,
    "标识信息/订单号": taskId || billingRequestId,
    "对内计价/云成本单价(元/单位)":
      snap.unitCostYuan != null ? snap.unitCostYuan.toFixed(6) : "",
    "对内计价/零售系数":
      snap.retailMultiplier != null ? String(snap.retailMultiplier) : "",
    "对内计价/我方单价(元/单位)":
      snap.ourUnitYuan != null ? snap.ourUnitYuan.toFixed(6) : "",
    "对内计价/计价公式与例": formula,
    "对内计价/本行扣点": String(opts.costPoints),
    "对内计价/折元参考(¥)": yuan.toFixed(4),
  };

  return row;
}

/**
 * 生成可直接插入 `prisma.toolBillingDetailLine.createMany` / `.create` 的数据对象（不含 `id` / `createdAt`）。
 * v002：接收 `snap` 快照，把云成本单价 / 零售系数 / 我方单价 / 命中行 id 写满 internal* 列。
 */
export function buildToolUsageBillingLineData(opts: {
  userId: string;
  toolKey: string;
  action: string;
  costPoints: number;
  meta: unknown;
  usageEventId: string;
  createdAt: Date;
  capturedAt?: Date;
  snap?: ToolUsagePricingSnapshot;
}): Prisma.ToolBillingDetailLineUncheckedCreateInput {
  const cloudRow = buildCloudRowFromUsage(opts);
  const captured = opts.capturedAt ?? new Date();
  const yuan = opts.costPoints / 100;

  const snap = opts.snap ?? {
    unitCostYuan: null,
    retailMultiplier: null,
    ourUnitYuan: null,
    schemeARefModelKey: null,
    billablePriceId: null,
  };
  const meta = asObjectOrEmpty(opts.meta);
  const modelKey =
    pickString(meta, "modelId") ||
    pickString(meta, "tryOnModel") ||
    pickString(meta, "videoModel") ||
    pickString(meta, "textToImageModel") ||
    pickString(meta, "apiModel");
  const formula = formulaForSnapshot({
    toolKey: opts.toolKey,
    action: opts.action,
    costPoints: opts.costPoints,
    snap,
    modelKey,
  });

  return {
    userId: opts.userId,
    toolUsageEventId: opts.usageEventId,
    source: "TOOL_USAGE_GENERATED",
    cloudRow: cloudRow as unknown as Prisma.InputJsonValue,
    pricingTemplateKey: PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1,
    internalCloudCostUnitYuan:
      snap.unitCostYuan != null ? new Prisma.Decimal(snap.unitCostYuan.toFixed(6)) : null,
    internalRetailMultiplier:
      snap.retailMultiplier != null ? new Prisma.Decimal(String(snap.retailMultiplier)) : null,
    internalOurUnitYuan:
      snap.ourUnitYuan != null ? new Prisma.Decimal(snap.ourUnitYuan.toFixed(6)) : null,
    internalFormulaText: formula,
    internalChargedPoints: opts.costPoints,
    internalYuanReference: new Prisma.Decimal(yuan.toFixed(4)),
    internalCapturedAt: captured,
  };
}
