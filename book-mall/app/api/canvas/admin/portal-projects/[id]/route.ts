import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import { getAdminPortalProjectPreview } from "@/lib/canvas/canvas-portal-publish-service";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 管理员 · 门户项目预览（含画布结构） */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const { id } = await ctx.params;
  try {
    const project = await getAdminPortalProjectPreview(id);
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
