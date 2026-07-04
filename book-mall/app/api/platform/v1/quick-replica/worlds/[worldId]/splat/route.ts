import { NextResponse } from "next/server";

import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { proxyWorldSplatAsset } from "@/lib/quick-replica/qr-world-splat-proxy";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  const { worldId } = await ctx.params;
  const upstreamUrl = new URL(request.url).searchParams.get("url")?.trim();
  if (!upstreamUrl) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  try {
    return await proxyWorldSplatAsset({
      userId: auth.userId,
      worldId,
      upstreamUrl,
    });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    const message = e instanceof Error ? e.message : "splat_proxy_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
