import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { sbv1CreatePortraitLivenessSession } from "@/lib/canvas/sbv1-portrait-liveness-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 创建真人人像 H5 活体认证会话（火山 CreateVisualValidateSession） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const session = await sbv1CreatePortraitLivenessSession(guard.user.id);
    return NextResponse.json(
      {
        bytedToken: session.bytedToken,
        h5Link: session.h5Link,
        callbackUrl: session.callbackUrl,
        expiresInSec: session.expiresInSec,
      },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
