import { type NextRequest, NextResponse } from "next/server";

import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { getMediaRenderJobForUser, cancelMediaRenderJobForUser } from "@/lib/media/media-render-service";

type Ctx = { params: Promise<{ jobId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { jobId } = await ctx.params;
  try {
    const job = await getMediaRenderJobForUser(jobId, guard.user.id);
    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "剪辑任务不存在" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json({ job }, { headers: jsonHeaders(request) });
  } catch (err) {
    const { mediaRenderErrorMessage } = await import(
      "@/lib/media/media-render-errors"
    );
    return NextResponse.json(
      { error: "POLL_FAILED", message: mediaRenderErrorMessage(err) },
      { status: 500, headers: jsonHeaders(request) },
    );
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { jobId } = await ctx.params;
  try {
    const result = await cancelMediaRenderJobForUser(jobId, guard.user.id);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    const { mediaRenderErrorMessage } = await import(
      "@/lib/media/media-render-errors"
    );
    return NextResponse.json(
      { error: "CANCEL_FAILED", message: mediaRenderErrorMessage(err) },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
}
