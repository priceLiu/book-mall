import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  parsePublishKind,
  submitCanvasProjectPortalReview,
} from "@/lib/canvas/canvas-portal-publish-service";
import { resolveCanvasApiAdmin } from "@/lib/canvas/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** POST · 用户提交作品进入审核（案例 / 精选 / 模板） */
export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  const kind = parsePublishKind(body.body.requestKind ?? body.body.kind);
  if (!kind) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message: "requestKind: CASE | FEATURED | TEMPLATE | PUBLIC_TEMPLATE",
      },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  try {
    const noteRaw = body.body.userNote ?? body.body.note;
    const isAdmin = await resolveCanvasApiAdmin(guard.user);
    const result = await submitCanvasProjectPortalReview({
      userId: guard.user.id,
      projectId: id,
      requestKind: kind,
      userNote: typeof noteRaw === "string" ? noteRaw : undefined,
      isAdmin,
    });
    return NextResponse.json(
      result,
      { status: result.appliedImmediately ? 200 : 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
