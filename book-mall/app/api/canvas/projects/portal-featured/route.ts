import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
} from "@/lib/canvas/api-helpers";
import { listPortalFeaturedCanvasProjects } from "@/lib/canvas/canvas-project-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 门户首页精选示例项目（公开，无需登录） */
export async function GET(request: NextRequest) {
  try {
    const projects = await listPortalFeaturedCanvasProjects();
    return NextResponse.json({ projects }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
