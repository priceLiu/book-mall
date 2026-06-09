import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  serviceFeeBillableHintJson,
  TOOL_SERVICE_FEE_MODE,
} from "@/lib/tool-service-fee-mode";
import { fetchCreditsPreview } from "@/lib/credits-preview-server";
import { resolveAiTryOnBillingModelId } from "@/lib/tools-scheme-a-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_FIT_BILLING_TOOL_KEY = "fitting-room__ai-fit";

export async function GET() {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  if (TOOL_SERVICE_FEE_MODE) {
    return NextResponse.json(serviceFeeBillableHintJson());
  }

  const model = resolveAiTryOnBillingModelId();
  const preview = await fetchCreditsPreview({ modelKey: model, imageCount: 1 });
  if (!preview) {
    return NextResponse.json({ error: "试衣积分报价未配置" }, { status: 503 });
  }

  return NextResponse.json({
    credits: preview.credits,
    yuan: preview.estimatedYuan,
    model: preview.canonicalModelKey,
    scheme: preview.scheme,
    pricePerCreditYuan: preview.pricePerCreditYuan,
    toolKey: AI_FIT_BILLING_TOOL_KEY,
  });
}
