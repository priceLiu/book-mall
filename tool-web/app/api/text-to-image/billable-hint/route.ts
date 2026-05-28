import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  serviceFeeBillableHintJson,
  TOOL_SERVICE_FEE_MODE,
} from "@/lib/tool-service-fee-mode";
import {
  computeTextToImageChargePoints,
  getTextToImageSchemeModelId,
} from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 文生图标价提示：Phase D 返回技术服务费说明；legacy 仍返回方案 A 点数。 */
export async function GET(req: Request) {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  if (TOOL_SERVICE_FEE_MODE) {
    return NextResponse.json(serviceFeeBillableHintJson());
  }

  const url = new URL(req.url);
  const nRaw = url.searchParams.get("n")?.trim() ?? "1";
  const n = Math.max(1, Math.min(4, parseInt(nRaw, 10) || 1));
  const model = getTextToImageSchemeModelId();
  const { multiplier: retailMult, source: multiplierSource } =
    await getSchemeARetailMultiplierServer({
      toolKey: "text-to-image",
      modelKey: model,
    });
  const pricePoints = computeTextToImageChargePoints(n, model, retailMult);
  if (pricePoints <= 0) {
    return NextResponse.json({ error: "文生图方案 A 标价未配置" }, { status: 503 });
  }

  return NextResponse.json({
    pricePoints,
    yuan: pricePoints / 100,
    imageCount: n,
    model,
    scheme: "tools_scheme_a",
    retailMultiplier: retailMult,
    retailMultiplierSource: multiplierSource,
  });
}
