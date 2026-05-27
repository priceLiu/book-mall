import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { testProviderForUser } from "@/lib/canvas/canvas-provider-service";
import {
  getGatewayVirtualProviderForUser,
  isGatewayVirtualProviderId,
} from "@/lib/canvas/canvas-gateway-providers";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import {
  isSystemProviderId,
  resolveSystemProvider,
} from "@/lib/canvas/canvas-system-provider";
import { getGatewayForKind } from "@/lib/canvas/providers";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (isGatewayVirtualProviderId(id)) {
    const row = await getGatewayVirtualProviderForUser(guard.user.id, id);
    if (!row) {
      return NextResponse.json(
        { ok: false, message: "Gateway 未关联或该厂商凭证未绑定" },
        { headers: jsonHeaders(request) },
      );
    }
    const link = await getGatewayLinkStatusForUser(guard.user.id);
    return NextResponse.json(
      {
        ok: link.linked && !link.revoked,
        message: link.linked
          ? `Gateway · ${row.alias} 已就绪`
          : "请先在 Book 个人中心关联 sk-gw",
      },
      { headers: jsonHeaders(request) },
    );
  }
  if (isSystemProviderId(id)) {
    const sys = resolveSystemProvider(id);
    if (!sys) {
      return NextResponse.json(
        { ok: false, message: "该系统 Provider 未启用（请检查 book-mall .env）" },
        { headers: jsonHeaders(request) },
      );
    }
    try {
      const gateway = getGatewayForKind(sys.kind, sys.config);
      const result = await gateway.testConnection();
      return NextResponse.json(result, { headers: jsonHeaders(request) });
    } catch (err) {
      return canvasErrorToResponse(request, err);
    }
  }
  try {
    const result = await testProviderForUser(guard.user.id, id);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
