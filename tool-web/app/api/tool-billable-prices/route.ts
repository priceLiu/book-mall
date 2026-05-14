import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import {
  VISUAL_LAB_ANALYSIS_ACTION,
  VISUAL_LAB_ANALYSIS_TOOL_KEY,
} from "@/lib/visual-lab-analysis-billing";
import { listVisualLabAnalysisSchemeAPriceRowsAsync } from "@/lib/visual-lab-analysis-scheme-a";
import { listToolsSchemeAPriceRowsAsync } from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "/api/sso/tools/billable-prices";

/** 聚合主站当前生效的 `ToolBillablePrice`，供「价格表」页展示。 */
export async function GET() {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) {
    return NextResponse.json(
      { error: "main_origin_not_configured" },
      { status: 503 },
    );
  }

  const r = await fetch(`${origin}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok || data == null) {
    return NextResponse.json(
      {
        error:
          typeof data?.error === "string" ? data.error : `upstream_${r.status}`,
      },
      { status: r.status >= 400 ? r.status : 502 },
    );
  }

  const rawPrices = data.prices;
  const prices = Array.isArray(rawPrices)
    ? rawPrices.filter((row) => {
        if (!row || typeof row !== "object") return true;
        const tk = (row as { toolKey?: unknown }).toolKey;
        const ac = (row as { action?: unknown }).action;
        if (tk === VISUAL_LAB_ANALYSIS_TOOL_KEY && ac === VISUAL_LAB_ANALYSIS_ACTION) {
          return false;
        }
        if (tk === "text-to-image" && ac === "invoke") return false;
        if (tk === "image-to-video" && ac === "invoke") return false;
        if (tk === "fitting-room__ai-fit" && ac === "try_on") return false;
        return true;
      })
    : rawPrices;

  const analysisSchemeA = await listVisualLabAnalysisSchemeAPriceRowsAsync(async (modelId) => {
    const { multiplier } = await getSchemeARetailMultiplierServer({
      toolKey: VISUAL_LAB_ANALYSIS_TOOL_KEY,
      modelKey: modelId,
    });
    return multiplier;
  });
  const toolsSchemeA = await listToolsSchemeAPriceRowsAsync(async (toolKey, modelId) => {
    const { multiplier } = await getSchemeARetailMultiplierServer({
      toolKey,
      modelKey: modelId,
    });
    return multiplier;
  });

  return NextResponse.json({ ...data, prices, analysisSchemeA, toolsSchemeA });
}
