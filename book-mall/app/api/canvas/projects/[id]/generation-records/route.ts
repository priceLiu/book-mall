import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import {
  listProjectTasks,
  listUserGenerationRecords,
} from "@/lib/canvas/canvas-task-service";
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
    const [projectTasks, todayTasks] = await Promise.all([
      listProjectTasks({ userId: guard.user.id, projectId }),
      listUserGenerationRecords({
        userId: guard.user.id,
        since,
        limit: 200,
      }),
    ]);
    const projectIds = [
      projectId,
      ...todayTasks.map((t) => t.projectId).filter(Boolean),
    ] as string[];
    const nodeIdsByProject = await loadCanvasNodeIdsByProjectForUser(
      guard.user.id,
      projectIds,
    );
    return NextResponse.json(
      {
        projectTasks: attachNodePresentToGenerationRecords(
          projectTasks,
          nodeIdsByProject,
          projectId,
        ),
        todayTasks: attachNodePresentToGenerationRecords(
          todayTasks,
          nodeIdsByProject,
        ),
        since: since.toISOString(),
      },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
