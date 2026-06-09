import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  serviceFeeBillableHintJson,
  TOOL_SERVICE_FEE_MODE,
} from "@/lib/tool-service-fee-mode";
import { fetchCreditsPreview } from "@/lib/credits-preview-server";

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
  const apiModel = url.searchParams.get("apiModel")?.trim() ?? "";
  if (!apiModel.length) {
    return NextResponse.json({ error: "缺少 apiModel" }, { status: 400 });
  }

  const durRaw = url.searchParams.get("durationSec")?.trim() ?? "15";
  const durationSec = Math.max(1, Math.min(15, parseInt(durRaw, 10) || 15));

  const preview = await fetchCreditsPreview({ modelKey: apiModel, durationSec });
  if (!preview) {
    return NextResponse.json({ error: "该模型暂无积分报价" }, { status: 503 });
  }

  return NextResponse.json({
    credits: preview.credits,
    yuan: preview.estimatedYuan,
    apiModel: preview.canonicalModelKey,
    durationSec,
    scheme: preview.scheme,
    pricePerCreditYuan: preview.pricePerCreditYuan,
    creditsPerUnit: preview.creditsPerUnit,
  });
}
