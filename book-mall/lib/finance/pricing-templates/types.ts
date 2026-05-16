/** 与入库 internal* 列对应 */
export type InternalPricingSnapshot = {
  cloudCostUnitYuan: string;
  retailMultiplier: string;
  ourUnitYuan: string;
  formulaText: string;
  chargedPoints: number;
  yuanReference: string;
};

/** 单云厂商 / 单账单格式的对内计价实现，在 registry 中注册。 */
export type PricingTemplateModule = {
  readonly id: string;
  /** 财务表「平台信息/计价模板」展示用 */
  readonly label: string;
  compute: (cloudRow: unknown) => InternalPricingSnapshot;
};
