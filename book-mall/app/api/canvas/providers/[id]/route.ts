import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getProviderForUser,
} from "@/lib/canvas/canvas-provider-service";
import { getGatewayVirtualProviderForUser } from "@/lib/canvas/canvas-gateway-providers";
import { isGatewayVirtualProviderId } from "@/lib/canvas/canvas-gateway-providers";
import { isSystemProviderId } from "@/lib/canvas/canvas-system-provider";

type Ctx = { params: Promise<{ id: string }> };

function rejectProviderMutation(id: string, request: NextRequest): NextResponse {
  if (isSystemProviderId(id) || isGatewayVirtualProviderId(id)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Gateway / 系统 Provider 不可修改 / 删除" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  return NextResponse.json(
    {
      error: "FORBIDDEN",
      message:
        "Canvas 自建 Provider 已下线。请在 Gateway 控制台绑定厂商凭证，并在 Book 个人中心关联 sk-gw",
    },
    { status: 403, headers: jsonHeaders(request) },
  );
}

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const gatewayRow = await getGatewayVirtualProviderForUser(guard.user.id, id);
    if (gatewayRow) {
      return NextResponse.json(
        { provider: gatewayRow },
        { headers: jsonHeaders(request) },
      );
    }
    const row = await getProviderForUser(guard.user.id, id);
    if (!row) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json(
      { provider: row },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  return rejectProviderMutation(id, request);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  return rejectProviderMutation(id, request);
}
