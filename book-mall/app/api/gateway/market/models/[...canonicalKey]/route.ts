import { NextResponse, type NextRequest } from "next/server";

import { resolveGatewayBillingPersona } from "@/lib/gateway/gateway-billing-persona";
import { getMarketModelDetail } from "@/lib/gateway/market-catalog";
import {
  getPlaygroundSchema,
  isPlaygroundSupported,
} from "@/lib/gateway/market-playground-schemas";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

function canonicalKeyFromSegments(segments: string[] | undefined): string {
  if (!segments?.length) return "";
  return decodeURIComponent(segments.map((s) => decodeURIComponent(s)).join("/"));
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ canonicalKey: string[] }> },
) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { canonicalKey: segments } = await ctx.params;
  const canonicalKey = canonicalKeyFromSegments(segments);
  if (!canonicalKey) {
    return NextResponse.json({ error: "缺少模型 key" }, { status: 400 });
  }

  const billingPersona = await resolveGatewayBillingPersona(user);
  const model = await getMarketModelDetail(canonicalKey, user.id, billingPersona);
  if (!model) {
    return NextResponse.json({ error: "模型不存在或未上架" }, { status: 404 });
  }

  const schema = getPlaygroundSchema(canonicalKey, model.requestKind);

  return NextResponse.json({
    model,
    playground: {
      supported: isPlaygroundSupported(canonicalKey) || schema.mode === "chat",
      schema,
    },
  });
}
