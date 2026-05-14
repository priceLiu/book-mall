import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID,
  getVisualLabAnalysisModelById,
} from "@/lib/visual-lab-analysis-models";
import {
  computeVisualLabAnalysisChargePoints,
  computeVisualLabAnalysisSchemeBreakdown,
} from "@/lib/visual-lab-analysis-scheme-a";
import { VISUAL_LAB_ANALYSIS_TOOL_KEY } from "@/lib/visual-lab-analysis-billing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 分析室单价提示：按方案 A 本地计算，与 `/api/visual-lab/analysis` 传入主站的 `costPoints` 一致。
 * Query：`modelId`（可选，须为已配置模型 id，否则用默认模型）。
 */
export async function GET(req: Request) {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("modelId")?.trim() ?? "";
  const modelId =
    raw.length > 0 && getVisualLabAnalysisModelById(raw) ? raw : DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID;

  const { multiplier: retailMult, source: multiplierSource } =
    await getSchemeARetailMultiplierServer({
      toolKey: VISUAL_LAB_ANALYSIS_TOOL_KEY,
      modelKey: modelId,
    });
  const pricePoints = computeVisualLabAnalysisChargePoints(modelId, retailMult);
  if (pricePoints <= 0) {
    return NextResponse.json({ error: "该模型暂无方案 A 标价" }, { status: 503 });
  }
  const breakdown = computeVisualLabAnalysisSchemeBreakdown(modelId, retailMult);
  return NextResponse.json({
    pricePoints,
    yuan: pricePoints / 100,
    modelId,
    scheme: "visual_lab_scheme_a",
    retailMultiplierSource: multiplierSource,
    ...(breakdown
      ? {
          equivalentInputMillion: breakdown.equivalentInputMillion,
          equivalentOutputMillion: breakdown.equivalentOutputMillion,
          retailMultiplier: breakdown.retailMultiplier,
        }
      : {}),
  });
}
