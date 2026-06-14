import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { getSbv1PortraitLivenessStatus } from "@/lib/canvas/sbv1-portrait-liveness-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 账号级真人人像活体认证状态（GroupId 与画布节点无关） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const status = await getSbv1PortraitLivenessStatus(guard.user.id);
    return NextResponse.json(status, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
