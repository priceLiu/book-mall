import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  computeAiTryOnChargePoints,
  resolveAiTryOnBillingModelId,
} from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_FIT_BILLING_TOOL_KEY = "fitting-room__ai-fit";

/** AI 试衣单次成片方案 A 标价提示（与 try-on 结算同源）。 */
export async function GET() {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const model = resolveAiTryOnBillingModelId();
  const { multiplier: retailMult, source: multiplierSource } =
    await getSchemeARetailMultiplierServer({
      toolKey: AI_FIT_BILLING_TOOL_KEY,
      modelKey: model,
    });
  const pricePoints = computeAiTryOnChargePoints(model, retailMult);
  if (pricePoints <= 0) {
    return NextResponse.json({ error: "试衣方案 A 标价未配置或无效" }, { status: 503 });
  }

  return NextResponse.json({
    pricePoints,
    yuan: pricePoints / 100,
    model,
    scheme: "tools_scheme_a",
    retailMultiplier: retailMult,
    retailMultiplierSource: multiplierSource,
    toolKey: AI_FIT_BILLING_TOOL_KEY,
  });
}
