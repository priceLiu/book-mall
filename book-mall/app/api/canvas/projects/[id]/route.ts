import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getCanvasProjectForUser,
  softDeleteCanvasProjectForUser,
  updateCanvasProjectForUser,
} from "@/lib/canvas/canvas-project-service";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const project = await getCanvasProjectForUser(guard.user.id, id);
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
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
  try {
    const project = await updateCanvasProjectForUser(guard.user.id, id, {
      name: typeof body.body.name === "string" ? body.body.name : undefined,
      description:
        typeof body.body.description === "string"
          ? body.body.description
          : undefined,
      canvas: body.body.canvas,
      thumbnailUrl:
        typeof body.body.thumbnailUrl === "string"
          ? body.body.thumbnailUrl
          : undefined,
    });
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    await softDeleteCanvasProjectForUser(guard.user.id, id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
