import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { listPortalFeaturedCanvasProjects } from "@/lib/canvas/canvas-project-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 门户首页精选示例项目（真实 thumbnailUrl，与「我的画布」同源） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projects = await listPortalFeaturedCanvasProjects();
    return NextResponse.json({ projects }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
