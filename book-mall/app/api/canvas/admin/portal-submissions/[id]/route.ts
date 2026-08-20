import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import {
  parsePublishKind,
  reviewCanvasPortalSubmission,
} from "@/lib/canvas/canvas-portal-publish-service";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** PATCH · 管理员审核门户提交 */
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
  const approve = body.body.approve;
  if (typeof approve !== "boolean") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "approve (boolean) required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const approvedKind = parsePublishKind(
    body.body.approvedKind ?? body.body.publishKind,
  );
  const adminNoteRaw = body.body.adminNote ?? body.body.note;
  try {
    const submission = await reviewCanvasPortalSubmission({
      submissionId: id,
      reviewerUserId: guard.user.id,
      approve,
      approvedKind: approve ? (approvedKind ?? undefined) : undefined,
      adminNote: typeof adminNoteRaw === "string" ? adminNoteRaw : undefined,
    });
    return NextResponse.json({ submission }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
