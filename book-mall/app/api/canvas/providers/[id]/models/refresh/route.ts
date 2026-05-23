import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { refreshProviderModelsForUser } from "@/lib/canvas/canvas-provider-service";
import { isSystemProviderId } from "@/lib/canvas/canvas-system-provider";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (isSystemProviderId(id)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "系统 Provider 模型清单内置，无需刷新" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  try {
    const provider = await refreshProviderModelsForUser(guard.user.id, id);
    return NextResponse.json(
      { provider },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
