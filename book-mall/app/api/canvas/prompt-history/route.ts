import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listUserPromptHistory,
  parsePromptHistoryQuery,
} from "@/lib/canvas/prompt-history";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 用户跨项目提示词历史（我的提示词历史） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const filters = parsePromptHistoryQuery(request.nextUrl.searchParams);
  try {
    const page = await listUserPromptHistory({
      userId: guard.user.id,
      ...filters,
    });
    return NextResponse.json(page, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
