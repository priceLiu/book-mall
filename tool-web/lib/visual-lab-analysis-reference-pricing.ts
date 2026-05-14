/**
 * 百炼官网「中国内地」标价摘要（元 / 百万 Token），用于向用户解释成本区间；
 * 与 {@link ../../doc/price.md} 非思考/首档阶梯口径一致，不含 Batch 半价。
 * 平台实际按次扣费见 ToolBillablePrice，与 Token 用量脱钩。
 */
import type { VisualLabAnalysisModelOption } from "@/lib/visual-lab-analysis-models";

export type VisualLabReferenceTier = {
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  tierNote: string;
};

const REFERENCE_BY_MODEL_ID: Record<string, VisualLabReferenceTier> = {
  "qwen3.6-plus": {
    inputYuanPerMillion: 2,
    outputYuanPerMillion: 12,
    tierNote: "0<输入Token≤256K · 中国内地",
  },
  "qwen3.6-flash": {
    inputYuanPerMillion: 1.2,
    outputYuanPerMillion: 7.2,
    tierNote: "0<输入Token≤256K · 中国内地",
  },
  "qwen3.5-plus": {
    inputYuanPerMillion: 0.8,
    outputYuanPerMillion: 4.8,
    tierNote: "0<输入Token≤128K · 中国内地",
  },
  "qwen3.5-flash": {
    inputYuanPerMillion: 0.2,
    outputYuanPerMillion: 2,
    tierNote: "0<输入Token≤128K · 中国内地",
  },
  "qwen3-vl-plus": {
    inputYuanPerMillion: 1,
    outputYuanPerMillion: 10,
    tierNote: "0<输入Token≤32K · 中国内地",
  },
  "qwen3-vl-flash": {
    inputYuanPerMillion: 0.15,
    outputYuanPerMillion: 1.5,
    tierNote: "0<输入Token≤32K · 中国内地",
  },
  "qwen-vl-max": {
    inputYuanPerMillion: 1.6,
    outputYuanPerMillion: 4,
    tierNote: "无阶梯 · 中国内地",
  },
  "qwen-vl-plus": {
    inputYuanPerMillion: 0.8,
    outputYuanPerMillion: 2,
    tierNote: "无阶梯 · 中国内地",
  },
};

/** 人民币/百万Token → 点/百万Token（100 点 = 1 元） */
export function yuanPerMillionTokToPoints(millionYuan: number): number {
  return Math.round(millionYuan * 100);
}

export function getVisualLabReferencePricing(
  modelId: string,
): VisualLabReferenceTier | null {
  return REFERENCE_BY_MODEL_ID[modelId] ?? null;
}

/** 用于下拉菜单旁展示一行参考价 */
export function formatReferencePricingLine(model: VisualLabAnalysisModelOption): string {
  const ref = getVisualLabReferencePricing(model.id);
  if (!ref) return model.description;
  const inPts = yuanPerMillionTokToPoints(ref.inputYuanPerMillion);
  const outPts = yuanPerMillionTokToPoints(ref.outputYuanPerMillion);
  return `${ref.tierNote} · 参考 ${inPts.toLocaleString("zh-CN")} 点/百万输入 · ${outPts.toLocaleString("zh-CN")} 点/百万输出（含税价以阿里云为准）`;
}
