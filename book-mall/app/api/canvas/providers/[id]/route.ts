import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  deleteProviderForUser,
  getProviderForUser,
  updateProviderForUser,
} from "@/lib/canvas/canvas-provider-service";
import { isSystemProviderId } from "@/lib/canvas/canvas-system-provider";

type Ctx = { params: Promise<{ id: string }> };

function rejectIfSystem(id: string, request: NextRequest): NextResponse | null {
  if (isSystemProviderId(id)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "系统 Provider 不可修改 / 删除" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  return null;
}

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
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
  const sysReject = rejectIfSystem(id, request);
  if (sysReject) return sysReject;
  try {
    const provider = await updateProviderForUser(guard.user.id, id, {
      alias:
        typeof body.body.alias === "string" ? body.body.alias : undefined,
      apiKey:
        typeof body.body.apiKey === "string" ? body.body.apiKey : undefined,
      baseUrl:
        body.body.baseUrl === null
          ? null
          : typeof body.body.baseUrl === "string"
            ? body.body.baseUrl
            : undefined,
      active:
        typeof body.body.active === "boolean" ? body.body.active : undefined,
    });
    return NextResponse.json(
      { provider },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const sysReject = rejectIfSystem(id, request);
  if (sysReject) return sysReject;
  try {
    await deleteProviderForUser(guard.user.id, id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
