import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import { setCanvasProjectPortalCase } from "@/lib/canvas/canvas-portal-publish-service";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** PATCH · 管理员设置门户案例 */
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
  const caseFlag = body.body.case;
  if (typeof caseFlag !== "boolean") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "case (boolean) required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  try {
    const sortRaw = body.body.sort;
    const blurbRaw = body.body.blurb;
    const project = await setCanvasProjectPortalCase({
      projectId: id,
      case: caseFlag,
      sort: typeof sortRaw === "number" ? sortRaw : undefined,
      blurb: typeof blurbRaw === "string" ? blurbRaw : undefined,
    });
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
