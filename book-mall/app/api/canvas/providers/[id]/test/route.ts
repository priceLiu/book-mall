import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getGatewayVirtualProviderForUser,
  isGatewayVirtualProviderId,
} from "@/lib/canvas/canvas-gateway-providers";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import {
  isSystemProviderId,
} from "@/lib/canvas/canvas-system-provider";

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
    return NextResponse.json(
      {
        ok: false,
        message: "厂商 env-key 直连测试已禁用；请关联 Gateway sk-gw 并在 Gateway 控制台绑定凭证",
      },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      message: "BYOK 直连测试已禁用；请使用 Gateway 虚拟 Provider 或关联 sk-gw",
    },
    { status: 403, headers: jsonHeaders(request) },
  );
}
