/**
 * 百炼官网「中国内地」标价摘要与下拉文案；实现见方案 A 目录。
 * @see doc/price.md · config/visual-lab-analysis-scheme-a-catalog.json
 */
export type { VisualLabReferenceTier } from "@/lib/visual-lab-analysis-scheme-a";
export {
  getVisualLabReferencePricing,
  formatReferencePricingLine,
  yuanPerMillionTokToPoints,
} from "@/lib/visual-lab-analysis-scheme-a";
