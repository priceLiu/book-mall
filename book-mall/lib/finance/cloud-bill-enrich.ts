/**
 * v005（2026-05-17）：把 `ToolBillingDetailLine` 行投影为前端展示用的扁平 row。
 *
 * 关键变化（相对 v004）：
 *   - **删除 `internalPricingSnapshotFromLine` / `prismaDataFromInternalSnapshot`**：
 *     ToolBillingDetailLine 的 `internal*` 7 列已从 schema 移除，所有"平台扣点 / 系数 / 定价"
 *     都直接读 cloudRow JSON 里 `buildCloudRowFromUsage` 写入的「平台/系数(M) + 平台/定价 + 平台/扣点」。
 *   - `enrichBillingLineToFlatRow` 入参收紧为 `{ cloudRow, pricingTemplateKey? }`；
 *     不再依赖 DB Decimal 列。CSV 导入路径（reconciliation-run.ts）会用
 *     `computeInternalPricingWithTemplate` 把"价格快照"直接写到 cloudRow 内的「平台/*」键。
 */
import { ALL_DISPLAY_KEYS } from "@/lib/finance/bill-display-keys";
import { cloudJsonToRawRow } from "@/lib/finance/pricing-templates/cloud-row-json";
import type { RawBillRow } from "@/lib/finance/pricing-templates/cloud-row-json";
import {
  computeInternalPricingWithTemplate,
  type InternalPricingSnapshot,
} from "@/lib/finance/pricing-templates/registry";
import { DEFAULT_PRICING_TEMPLATE_KEY } from "@/lib/finance/pricing-templates/keys";

export type { InternalPricingSnapshot } from "@/lib/finance/pricing-templates/registry";
export { cloudJsonToRawRow } from "@/lib/finance/pricing-templates/cloud-row-json";

/** @deprecated 请使用 `computeInternalPricingWithTemplate(cloudRow, templateKey)`；此为阿里云默认模板兼容别名 */
export function computeInternalPricingFromCloudRow(cloudRow: unknown): InternalPricingSnapshot {
  return computeInternalPricingWithTemplate(cloudRow, DEFAULT_PRICING_TEMPLATE_KEY);
}

export { computeInternalPricingWithTemplate } from "@/lib/finance/pricing-templates/registry";

/**
 * 阿里云 CSV 原 key prefix → v006 Round 4 新 key prefix 的映射表。
 *
 * 设计：CLOUD_CSV_IMPORT 行的 cloudRow JSON 保留阿里云原 keys（reconciliation 内部读路径仍按
 * "应付信息/应付金额（含税）" / "用量信息/用量" 等查询，不动）。enrich 投影到 32 列展示时由
 * 此 map 自动把旧 keys 复制到新 keys。
 *
 * 仅做"value 复制"，不删除阿里云原 key——CSV 行原始数据在 cloudRow JSON 内仍可审计。
 */
const ALIYUN_LEGACY_TO_NEW_KEY: ReadonlyArray<[string, string]> = [
  // 账单时间组（"我们记录的"用户消费时刻 / CSV 行=云返回时刻）
  ["账单信息/账单月份", "平台账单/账单月份"],
  ["账单信息/账单日期", "平台账单/账单日期"],
  ["账单信息/费用类型", "平台账单/费用类型"],
  ["账单信息/消费时间", "平台账单/消费时间"],
  ["账单信息/服务开始时间", "平台账单/服务开始时间"],
  ["账单信息/服务结束时间", "平台账单/服务结束时间"],
  // 用量组
  ["用量信息/抵扣前用量", "平台用量/抵扣前用量"],
  ["用量信息/用量", "平台用量/用量"],
  ["用量信息/用量单位", "平台用量/用量单位"],
  // 厂商产品 5 列
  ["产品信息/产品名称", "厂商产品/产品名称"],
  ["产品信息/商品Code", "厂商产品/商品Code"],
  ["产品信息/商品名称", "厂商产品/商品名称"],
  ["产品信息/计费项Code", "厂商产品/计费项Code"],
  ["产品信息/计费项名称", "厂商产品/计费项名称"],
  // 厂商资源
  ["资源信息/实例ID（出账粒度）", "厂商资源/实例ID（出账粒度）"],
  // 厂商定价
  ["定价信息/官网目录价", "厂商定价/官网目录价"],
  ["定价信息/价格单位", "厂商定价/价格单位"],
  ["定价信息/目录价用量阶梯", "厂商定价/目录价用量阶梯"],
  ["定价信息/定价币种", "厂商定价/定价币种"],
  // 厂商优惠
  ["优惠信息/优惠金额", "厂商优惠/优惠金额"],
  ["优惠信息/优惠详情", "厂商优惠/优惠详情"],
  // v007 Round 5：CSV 行的「费用信息/计费公式」+「应付信息/应付金额（含税）」
  // 投到平台组（CSV 行的语义是"平台对云应付"；TOOL_USAGE_GENERATED 行 buildCloudRowFromUsage 已直接写）
  ["费用信息/计费公式", "平台/计费公式"],
  ["应付信息/应付金额（含税）", "平台/应付金额"],
  // 「费用信息/目录总价」不再展示——v007 Round 5 删除该列
];

/**
 * 合并 cloudRow（含云 CSV 原列或 TOOL_USAGE_GENERATED 写好的扁平列）+ 平台 8 列展示需要。
 *
 * 行为分两类：
 *   - **TOOL_USAGE_GENERATED 行**：`buildCloudRowFromUsage` 已把所有 9 组 32 列（新 key 名）
 *     写入 cloudRow JSON；此处只是用入参 `platformUserId/Label` 兜底。
 *   - **CLOUD_CSV_IMPORT 行**：cloudRow 是阿里云 CSV 原 keys；按 `ALIYUN_LEGACY_TO_NEW_KEY`
 *     把它们投到新 key 名上（旧 key 仍保留在 cloudRow JSON 内）。再同步把「厂商应付/应付金额（含税）」
 *     回填到「平台/扣点」字段（折点 = 应付 × 100），让头部 "平台扣点合计" 在 CSV 行也参与聚合。
 */
export function enrichCloudRowToFlat(
  cloudRow: unknown,
  platformUserId: string,
  platformUserLabel: string,
): Record<string, string> {
  const row = cloudJsonToRawRow(cloudRow);

  const enriched: RawBillRow = {
    ...row,
    "平台/用户ID": row["平台/用户ID"]?.trim() || platformUserId,
    "平台/用户名": row["平台/用户名"]?.trim() || platformUserLabel,
  };

  // v006 Round 4：把阿里云原 key 复制到新 key（仅当 cloudRow 是 CSV 行时这些旧 key 才存在；
  // TOOL_USAGE_GENERATED 行 buildCloudRowFromUsage 已直接写新 key，无旧 key 也无副作用）。
  for (const [oldKey, newKey] of ALIYUN_LEGACY_TO_NEW_KEY) {
    if (enriched[newKey] != null && enriched[newKey] !== "") continue;
    const v = row[oldKey];
    if (v != null && v !== "") enriched[newKey] = v;
  }

  // 平台/产品Code/名称/计费项Code 由 applyCanonicalOverlay 后续填——这里若行内已有则保留
  if (!enriched["平台/产品Code"] && row["产品信息/商品Code"]?.trim()) {
    enriched["平台/产品Code"] = row["产品信息/商品Code"]!.trim();
  }
  if (!enriched["平台/产品名称"] && row["产品信息/商品名称"]?.trim()) {
    enriched["平台/产品名称"] = row["产品信息/商品名称"]!.trim();
  }
  if (!enriched["平台/计费项Code"] && row["产品信息/计费项Code"]?.trim()) {
    enriched["平台/计费项Code"] = row["产品信息/计费项Code"]!.trim();
  }

  /**
   * CSV 行回填「平台/扣点」：CSV cloudRow 没有这一列，但展示侧的"平台扣点合计"统计需要参与。
   * 折算口径：应付（含税元）× 100 → 点。读阿里云原 key 或新 key 任一可得。
   */
  if (!enriched["平台/扣点"]) {
    const payable = parseFloat(
      row["应付信息/应付金额（含税）"] || enriched["平台/应付金额"] || "0",
    );
    if (Number.isFinite(payable) && payable > 0) {
      enriched["平台/扣点"] = String(Math.round(payable * 100));
    }
  }

  const out: Record<string, string> = {};
  for (const k of ALL_DISPLAY_KEYS) {
    out[k] = enriched[k] ?? "";
  }
  return out;
}

/**
 * 单行投影：用 ToolBillingDetailLine 的 cloudRow JSON + 入参 user 标识，输出 32 列扁平 row。
 * v005：不再读 DB internal* 列；所有"对内计价"信息都在 cloudRow 里。
 */
export function enrichBillingLineToFlatRow(
  line: {
    cloudRow: unknown;
  },
  platformUserId: string,
  platformUserLabel: string,
): Record<string, string> {
  return enrichCloudRowToFlat(line.cloudRow, platformUserId, platformUserLabel);
}
