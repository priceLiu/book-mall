import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { sbv1PollPortraitLivenessResult } from "@/lib/canvas/sbv1-portrait-liveness-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 轮询 H5 活体结果（火山 GetVisualValidateResult） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      bytedToken?: string;
    };
    const result = await sbv1PollPortraitLivenessResult(
      guard.user.id,
      String(body.bytedToken ?? ""),
    );
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
