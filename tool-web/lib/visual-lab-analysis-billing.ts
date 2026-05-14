/**
 * 分析室计费：toolKey + action 标识流水；单价由工具站方案 A 计算并经 `costPoints` 传给主站。
 */
import {
  computeVisualLabAnalysisChargePoints,
  visualLabSchemeARetailMultiplierCatalogFallback,
} from "@/lib/visual-lab-analysis-scheme-a";
import { DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID } from "@/lib/visual-lab-analysis-models";

export const VISUAL_LAB_ANALYSIS_TOOL_KEY = "visual-lab__analysis";
export const VISUAL_LAB_ANALYSIS_ACTION = "invoke";

/** 无法拉取 billable-hint 时，与默认模型方案 A 标价对齐的展示回退。 */
export const VISUAL_LAB_ANALYSIS_DEFAULT_PRICE_POINTS = computeVisualLabAnalysisChargePoints(
  DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID,
  visualLabSchemeARetailMultiplierCatalogFallback(),
);
