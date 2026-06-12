import { type NextRequest, NextResponse } from "next/server";

import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { getMediaRenderJobForUser } from "@/lib/media/media-render-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { jobId } = await ctx.params;
  const job = await getMediaRenderJobForUser(jobId, guard.user.id);
  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "剪辑任务不存在" },
      { status: 404, headers: jsonHeaders(request) },
    );
  }
  return NextResponse.json({ job }, { headers: jsonHeaders(request) });
}
