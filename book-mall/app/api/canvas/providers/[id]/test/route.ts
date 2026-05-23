import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { testProviderForUser } from "@/lib/canvas/canvas-provider-service";
import {
  isKieSystemEnabled,
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
  if (isSystemProviderId(id)) {
    if (!isKieSystemEnabled()) {
      return NextResponse.json(
        { ok: false, message: "系统 KIE Key 未配置" },
        { headers: jsonHeaders(request) },
      );
    }
    try {
      const sys = resolveSystemProvider(id)!;
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
