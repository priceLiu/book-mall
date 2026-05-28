import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  serviceFeeBillableHintJson,
  TOOL_SERVICE_FEE_MODE,
} from "@/lib/tool-service-fee-mode";
import { computeVideoChargePoints } from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 视频单次标价提示：Phase D 返回技术服务费说明；legacy 仍返回方案 A 点数。 */
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

  const durRaw = url.searchParams.get("durationSec")?.trim() ?? "5";
  const durationSec = Math.max(1, Math.min(120, parseInt(durRaw, 10) || 5));

  const resRaw = url.searchParams.get("resolution")?.trim()?.toUpperCase() ?? "1080P";
  const sr =
    resRaw === "720P" || resRaw === "720"
      ? 720
      : resRaw === "480P" || resRaw === "480"
        ? 480
        : 1080;

  const audio =
    url.searchParams.get("audio") === null
      ? true
      : url.searchParams.get("audio") !== "false";

  const { multiplier: retailMult, source: multiplierSource } =
    await getSchemeARetailMultiplierServer({
      toolKey: "image-to-video",
      modelKey: apiModel,
    });
  const pricePoints = computeVideoChargePoints(
    {
      apiModel,
      durationSec,
      sr,
      audio,
    },
    retailMult,
  );
  if (pricePoints <= 0) {
    return NextResponse.json(
      { error: "该模型暂无方案 A 标价，请检查 tools-scheme-a-catalog" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    pricePoints,
    yuan: pricePoints / 100,
    apiModel,
    durationSec,
    resolutionHint: sr,
    audio,
    scheme: "tools_scheme_a",
    retailMultiplier: retailMult,
    retailMultiplierSource: multiplierSource,
  });
}
