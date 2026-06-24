import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import {
  listProjectGenerationRecords,
  listUserGenerationRecords,
} from "@/lib/canvas/canvas-task-service";
import { parseGenerationRecordLimit } from "@/lib/canvas/generation-task-page-cursor";
import {
  attachNodePresentToGenerationRecords,
  loadCanvasNodeIdsByProjectForUser,
} from "@/lib/canvas/generation-record-node-present";

type Ctx = { params: Promise<{ id: string }> };

function startOfTodayBeijing(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const bj = new Date(utc + 8 * 3_600_000);
  bj.setHours(0, 0, 0, 0);
  const backUtc = bj.getTime() - 8 * 3_600_000;
  return new Date(backUtc - now.getTimezoneOffset() * 60_000);
}

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 画布「生成记录」：本项目全部任务 + 用户今日跨项目任务（含成功/失败）。 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  try {
    await assertAccessibleCanvasProject(guard.user.id, projectId);
    const since = startOfTodayBeijing();
    const sp = request.nextUrl.searchParams;
    const projectLimitRaw = sp.get("projectLimit");
    const todayLimitRaw = sp.get("todayLimit");
    const projectLimit = projectLimitRaw
      ? parseGenerationRecordLimit(projectLimitRaw)
      : null;
    const todayLimit = todayLimitRaw
      ? parseGenerationRecordLimit(todayLimitRaw)
      : null;
    const projectCursor = sp.get("projectCursor")?.trim() || undefined;
    const todayCursor = sp.get("todayCursor")?.trim() || undefined;

    const [projectPage, todayPage] = await Promise.all([
      projectLimit != null
        ? listProjectGenerationRecords({
            userId: guard.user.id,
            projectId,
            limit: projectLimit,
            cursor: projectCursor,
          })
        : Promise.resolve({
            items: [],
            hasMore: false,
            nextCursor: null as string | null,
          }),
      todayLimit != null
        ? listUserGenerationRecords({
            userId: guard.user.id,
            since,
            limit: todayLimit,
            cursor: todayCursor,
          })
        : Promise.resolve({
            items: [],
            hasMore: false,
            nextCursor: null as string | null,
          }),
    ]);
    const projectIds = [
      projectId,
      ...todayPage.items.map((t) => t.projectId).filter(Boolean),
    ] as string[];
    const nodeIdsByProject = await loadCanvasNodeIdsByProjectForUser(
      guard.user.id,
      projectIds,
    );
    return NextResponse.json(
      {
        projectTasks: attachNodePresentToGenerationRecords(
          projectPage.items,
          nodeIdsByProject,
          projectId,
        ),
        todayTasks: attachNodePresentToGenerationRecords(
          todayPage.items,
          nodeIdsByProject,
        ),
        projectHasMore: projectPage.hasMore,
        projectNextCursor: projectPage.nextCursor,
        todayHasMore: todayPage.hasMore,
        todayNextCursor: todayPage.nextCursor,
        since: since.toISOString(),
      },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
