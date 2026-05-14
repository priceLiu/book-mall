/**
 * 视觉实验室 · 分析室：方案 A 定价（官网首档元/百万 Token × 约定等价 Token → 成本 → × retail → 点数）。
 * 单一真源：{@link ../config/visual-lab-analysis-scheme-a-catalog.json}
 */
import catalog from "@/config/visual-lab-analysis-scheme-a-catalog.json";
import type { VisualLabAnalysisModelOption } from "@/lib/visual-lab-analysis-models";
import { getVisualLabAnalysisModelById } from "@/lib/visual-lab-analysis-models";

export type VisualLabReferenceTier = {
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  tierNote: string;
};

type CatalogModel = {
  id: string;
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  tierNote: string;
  equivalentInputMillion?: number | null;
  equivalentOutputMillion?: number | null;
};

type SchemeACatalog = {
  retailMultiplier: number;
  schemeNote?: string;
  defaultEquivalentInputMillion: number;
  defaultEquivalentOutputMillion: number;
  models: CatalogModel[];
};

const cat = catalog as SchemeACatalog;
const byId = new Map(cat.models.map((m) => [m.id, m]));

/** 主站规则不可用时与分析室 catalog 对齐的回退系数。 */
export function visualLabSchemeARetailMultiplierCatalogFallback(): number {
  const m = cat.retailMultiplier;
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 2;
}

function equivalentFor(model: CatalogModel): { inM: number; outM: number } {
  const inM = model.equivalentInputMillion ?? cat.defaultEquivalentInputMillion;
  const outM = model.equivalentOutputMillion ?? cat.defaultEquivalentOutputMillion;
  return { inM, outM };
}

/** 人民币/百万Token → 点/百万Token（100 点 = 1 元，与零售标价口径一致的上游元价换算） */
export function yuanPerMillionTokToPoints(millionYuan: number): number {
  return Math.round(millionYuan * 100);
}

export function getVisualLabReferencePricing(modelId: string): VisualLabReferenceTier | null {
  const m = byId.get(modelId);
  if (!m) return null;
  return {
    inputYuanPerMillion: m.inputYuanPerMillion,
    outputYuanPerMillion: m.outputYuanPerMillion,
    tierNote: m.tierNote,
  };
}

/** 方案 A 单次扣费点数；未知模型返回 0。 */
export function computeVisualLabAnalysisChargePoints(
  modelId: string,
  retailMult: number = visualLabSchemeARetailMultiplierCatalogFallback(),
): number {
  const m = byId.get(modelId);
  if (!m) return 0;
  const { inM, outM } = equivalentFor(m);
  const costYuan = inM * m.inputYuanPerMillion + outM * m.outputYuanPerMillion;
  const retailYuan = costYuan * retailMult;
  return Math.max(1, Math.round(retailYuan * 100));
}

export type VisualLabAnalysisSchemeBreakdown = {
  equivalentInputMillion: number;
  equivalentOutputMillion: number;
  costYuan: number;
  retailMultiplier: number;
  retailYuan: number;
  pricePoints: number;
};

export function computeVisualLabAnalysisSchemeBreakdown(
  modelId: string,
  retailMult: number = visualLabSchemeARetailMultiplierCatalogFallback(),
): VisualLabAnalysisSchemeBreakdown | null {
  const m = byId.get(modelId);
  if (!m) return null;
  const { inM, outM } = equivalentFor(m);
  const costYuan = inM * m.inputYuanPerMillion + outM * m.outputYuanPerMillion;
  const retailYuan = costYuan * retailMult;
  const pricePoints = Math.max(1, Math.round(retailYuan * 100));
  return {
    equivalentInputMillion: inM,
    equivalentOutputMillion: outM,
    costYuan,
    retailMultiplier: retailMult,
    retailYuan,
    pricePoints,
  };
}

/** 下拉旁一行：官网阶梯摘要 + 点/百万参考（不含方案 A 乘数，便于与文档对照）。 */
export function formatReferencePricingLine(model: VisualLabAnalysisModelOption): string {
  const ref = getVisualLabReferencePricing(model.id);
  if (!ref) return model.description;
  const inPts = yuanPerMillionTokToPoints(ref.inputYuanPerMillion);
  const outPts = yuanPerMillionTokToPoints(ref.outputYuanPerMillion);
  return `${ref.tierNote} · 参考 ${inPts.toLocaleString("zh-CN")} 点/百万输入 · ${outPts.toLocaleString("zh-CN")} 点/百万输出（含税价以阿里云为准）`;
}

/** 「价格表」区块：各模型方案 A 单次点数。 */
export function listVisualLabAnalysisSchemeAPriceRows(
  retailMult: number = visualLabSchemeARetailMultiplierCatalogFallback(),
): Array<{
  modelId: string;
  title: string;
  pricePoints: number;
  yuan: number;
  note: string;
}> {
  return cat.models.map((m) => {
    const meta = getVisualLabAnalysisModelById(m.id);
    const title = meta?.title ?? m.id;
    const pts = computeVisualLabAnalysisChargePoints(m.id, retailMult);
    const { inM, outM } = equivalentFor(m);
    return {
      modelId: m.id,
      title,
      pricePoints: pts,
      yuan: pts / 100,
      note: `方案 A · ${m.tierNote} · 等价 ${inM}M 入 + ${outM}M 出 · ×${retailMult}`,
    };
  });
}

/** 价格表：按模型分别解析主站系数后的分析室方案 A 行。 */
export async function listVisualLabAnalysisSchemeAPriceRowsAsync(
  getMult: (modelId: string) => Promise<number>,
): Promise<
  Array<{
    modelId: string;
    title: string;
    pricePoints: number;
    yuan: number;
    note: string;
  }>
> {
  return Promise.all(
    cat.models.map(async (m) => {
      const meta = getVisualLabAnalysisModelById(m.id);
      const title = meta?.title ?? m.id;
      const mult = await getMult(m.id);
      const pts = computeVisualLabAnalysisChargePoints(m.id, mult);
      const { inM, outM } = equivalentFor(m);
      return {
        modelId: m.id,
        title,
        pricePoints: pts,
        yuan: pts / 100,
        note: `方案 A · ${m.tierNote} · 等价 ${inM}M 入 + ${outM}M 出 · ×${mult}`,
      };
    }),
  );
}
