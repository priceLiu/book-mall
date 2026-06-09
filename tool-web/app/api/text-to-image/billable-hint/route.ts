import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  serviceFeeBillableHintJson,
  TOOL_SERVICE_FEE_MODE,
} from "@/lib/tool-service-fee-mode";
import { fetchCreditsPreview } from "@/lib/credits-preview-server";
import { getTextToImageSchemeModelId } from "@/lib/tools-scheme-a-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const preview = await fetchCreditsPreview({ modelKey: model, imageCount: n });
  if (!preview) {
    return NextResponse.json({ error: "文生图积分报价未配置" }, { status: 503 });
  }

  return NextResponse.json({
    credits: preview.credits,
    yuan: preview.estimatedYuan,
    imageCount: n,
    model: preview.canonicalModelKey,
    scheme: preview.scheme,
    pricePerCreditYuan: preview.pricePerCreditYuan,
    creditsPerUnit: preview.creditsPerUnit,
  });
}
