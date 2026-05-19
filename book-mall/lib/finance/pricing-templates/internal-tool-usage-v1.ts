/**
 * v005（2026-05-17）：「工具站内部使用」对内计价模板。
 *
 * v005 起 `ToolBillingDetailLine.internal*` 7 列已从 schema 删除，"对内计价快照"统一存在
 * cloudRow JSON 内的「平台/系数(M) + 平台/定价 + 平台/扣点」键里（`buildCloudRowFromUsage` 写入）。
 *
 * 因此本模块 `compute(cloudRow)` 已变为**兜底死路径**——`enrichBillingLineToFlatRow` 不再
 * 调它（直接读 cloudRow 的「平台/*」键）。仅当 reconciliation 流程或异常路径需要"按模板算个快照"
 * 时才会进入；返回全 0 占位即可。
 *
 * 保留模板 id 与 label：`pricingTemplateKey` 历史值 `internal.tool_usage_v1` 仍指向本模块，
 * 避免 registry fallback 到 aliyun 模板时把 TOOL_USAGE_GENERATED 行错按 CSV 公式估算。
 */
import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";

export const internalToolUsageV1Template: PricingTemplateModule = {
  id: "internal.tool_usage_v1",
  label: "工具站使用 · DB 快照",
  compute(_cloudRow: unknown): InternalPricingSnapshot {
    return {
      cloudCostUnitYuan: "0.000000",
      retailMultiplier: "0",
      ourUnitYuan: "0.000000",
      formulaText: "",
      chargedPoints: 0,
      yuanReference: "0.0000",
    };
  },
};
