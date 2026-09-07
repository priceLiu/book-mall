import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  isAdmin,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { listPortalAdminMetaIds } from "@/lib/canvas/canvas-portal-publish-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 管理员门户上下架 ID（合并 featured + cases，减少列表页并发） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.user)) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }

  const meta = await listPortalAdminMetaIds();
  return NextResponse.json(meta, { headers: jsonHeaders(request) });
}
