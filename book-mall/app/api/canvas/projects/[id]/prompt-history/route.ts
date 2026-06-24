import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listProjectPromptHistory,
  parsePromptHistoryQuery,
} from "@/lib/canvas/prompt-history";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 本项目已提交提示词历史（从生成任务 inputPayload 自动归档） */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  const filters = parsePromptHistoryQuery(request.nextUrl.searchParams);
  try {
    const page = await listProjectPromptHistory({
      userId: guard.user.id,
      projectId,
      ...filters,
    });
    return NextResponse.json(page, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
