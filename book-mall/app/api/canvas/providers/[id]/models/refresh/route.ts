import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { isSystemProviderId } from "@/lib/canvas/canvas-system-provider";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** Gateway-only：禁止 BYOK 本地刷新模型清单。 */
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
  return NextResponse.json(
    {
      error: "FORBIDDEN",
      message: "模型清单由 Gateway 登记，不支持本地 BYOK 刷新；请在 Gateway 控制台管理",
    },
    { status: 403, headers: jsonHeaders(request) },
  );
}
