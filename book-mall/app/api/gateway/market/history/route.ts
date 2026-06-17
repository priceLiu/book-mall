import { NextResponse, type NextRequest } from "next/server";

import { listMarketPlaygroundHistory } from "@/lib/gateway/market-playground-service";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const canonicalKey = request.nextUrl.searchParams.get("canonicalKey")?.trim();
  if (!canonicalKey) {
    return NextResponse.json({ error: "canonicalKey required" }, { status: 400 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "8");
  const items = await listMarketPlaygroundHistory(user, { canonicalKey, limit });

  return NextResponse.json({ items });
}
