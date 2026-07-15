import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import { setCanvasProjectPortalFeatured } from "@/lib/canvas/canvas-project-service";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** PATCH · 管理员设置门户精选示例 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  const featured = body.body.featured;
  if (typeof featured !== "boolean") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "featured (boolean) required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  try {
    const sortRaw = body.body.sort;
    const blurbRaw = body.body.blurb;
    const project = await setCanvasProjectPortalFeatured({
      projectId: id,
      featured,
      sort: typeof sortRaw === "number" ? sortRaw : undefined,
      blurb: typeof blurbRaw === "string" ? blurbRaw : undefined,
    });
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
