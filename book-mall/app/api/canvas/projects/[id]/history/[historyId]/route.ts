import { type NextRequest, NextResponse } from "next/server";

import { getCanvasProjectHistoryForUser } from "@/lib/canvas/canvas-project-history-service";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";

type Ctx = { params: Promise<{ id: string; historyId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, historyId } = await ctx.params;
  try {
    const item = await getCanvasProjectHistoryForUser(
      guard.user.id,
      id,
      historyId,
    );
    return NextResponse.json({ item }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
