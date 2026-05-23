import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { updateProviderModelForUser } from "@/lib/canvas/canvas-provider-service";
import { isSystemProviderId } from "@/lib/canvas/canvas-system-provider";

type Ctx = { params: Promise<{ id: string; modelId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id, modelId } = await ctx.params;
  if (isSystemProviderId(id)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "系统 Provider 模型不可修改" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  try {
    const model = await updateProviderModelForUser(
      guard.user.id,
      id,
      modelId,
      {
        enabled:
          typeof body.body.enabled === "boolean" ? body.body.enabled : undefined,
        sortOrder:
          typeof body.body.sortOrder === "number"
            ? body.body.sortOrder
            : undefined,
        displayName:
          typeof body.body.displayName === "string"
            ? body.body.displayName
            : undefined,
      },
    );
    return NextResponse.json({ model }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
