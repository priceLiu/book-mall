/**
 * 上架工作单：由「导入的成本（元/百万 Token）」与等价用量、零售系数推算点数（与方案 A 一致）。
 */
export type SchemeATokenCostPreview = {
  /** 成本（元） */
  costYuan: number;
  retailYuan: number;
  pricePoints: number;
  steps: string[];
};

/**
 * @param inputYuanPerMillion 中国内地首档入向单价（元/百万 Token）
 * @param outputYuanPerMillion 中国内地首档出向单价（元/百万 Token）
 * @param eqInMillion 等价输入百万 Token
 * @param eqOutMillion 等价输出百万 Token
 * @param retailMultiplier 当前零售系数 M（可与主站 `ToolRetailMultiplierRule` 一致）
 */
export function previewSchemeATokenRetailPoints(opts: {
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  eqInMillion: number;
  eqOutMillion: number;
  retailMultiplier: number;
}): SchemeATokenCostPreview {
  const {
    inputYuanPerMillion: i,
    outputYuanPerMillion: o,
    eqInMillion: ein,
    eqOutMillion: eout,
    retailMultiplier: M,
  } = opts;
  const costYuan = ein * i + eout * o;
  const retailYuan = costYuan * M;
  const pricePoints = Math.max(1, Math.round(retailYuan * 100));
  const steps = [
    `costYuan = ${ein} × ${i} + ${eout} × ${o} = ${costYuan}`,
    `retailYuan = costYuan × M = ${costYuan} × ${M} = ${retailYuan}`,
    `pricePoints = max(1, round(retailYuan × 100)) = ${pricePoints}`,
  ];
  return { costYuan, retailYuan, pricePoints, steps };
}
