import { NextResponse } from "next/server";

import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { qrGetWorldViewerPayload } from "@/lib/quick-replica/qr-world-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  const { worldId } = await ctx.params;
  try {
    const payload = await qrGetWorldViewerPayload(auth.userId, worldId);
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    const message = e instanceof Error ? e.message : "获取场景失败";
    const lower = message.toLowerCase();
    const status =
      lower.includes("404") || lower.includes("not found") || lower.includes("未找到")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
