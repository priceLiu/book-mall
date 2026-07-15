import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { duplicatePortalFeaturedProjectForUser } from "@/lib/canvas/canvas-project-service";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** POST · 从门户示例复制到当前用户画布 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const project = await duplicatePortalFeaturedProjectForUser(guard.user.id, id);
    return NextResponse.json(
      { project },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
