import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { listPortalCaseCanvasProjects } from "@/lib/canvas/canvas-portal-publish-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

function parsePortalCaseEdition(
  raw: string | null,
): "pro2" | "sbv1" | undefined {
  const edition = raw?.trim();
  if (edition === "pro2" || edition === "sbv1") return edition;
  return undefined;
}

/** GET · 门户首页案例墙（?edition=sbv1 为分镜视频 1.0 影视案例） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const edition = parsePortalCaseEdition(
      request.nextUrl.searchParams.get("edition"),
    );
    const projects = await listPortalCaseCanvasProjects(
      edition ? { edition } : undefined,
    );
    return NextResponse.json({ projects }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
