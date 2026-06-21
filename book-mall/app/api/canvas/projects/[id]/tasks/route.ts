import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listProjectTasks,
  scheduleOpportunisticCanvasPoll,
} from "@/lib/canvas/canvas-task-service";
import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 读道（用户显示）与轮询道（厂商→DB 对账）彻底分离：
 * 本接口只负责「快速读出当前任务状态」，绝不在请求内同步轮询厂商 / 写库，
 * 避免一条慢路径（DB 连接池耗尽 / 厂商 recordInfo 慢）拖死整个画布显示。
 *
 * - 读超时：超过 READ_TIMEOUT_MS 立即返回 stale，让前端保留上一帧，不白屏。
 * - DB 不可用：返回 { tasks: null, stale: true } + 200，前端保留上次快照。
 * - 后台疏导：有进行中任务时 fire-and-forget 触发一次轮询（节流），不 await。
 *   正式环境由 cron / poll-loop 推进；此处仅为 nopoll 模式兜底。
 */
const READ_TIMEOUT_MS = (() => {
  const raw = Number(process.env.CANVAS_TASKS_READ_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw >= 1000 ? raw : 6000;
})();

/** 与 canvas-kie-gateway-claim 一致的「进行中」状态集合 */
const CANVAS_INFLIGHT_STATUS = new Set<string>([
  "PENDING",
  "SUBMITTED",
  "QUEUED",
  "DISPATCHING",
]);

class CanvasTasksReadTimeout extends Error {
  constructor() {
    super("canvas tasks read timeout");
    this.name = "CanvasTasksReadTimeout";
  }
}

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  const url = new URL(request.url);
  const nodeIdsParam = url.searchParams.get("nodeIds");
  const nodeIds = nodeIdsParam
    ? nodeIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const tasks = await Promise.race([
      listProjectTasks({
        userId: guard.user.id,
        projectId,
        nodeIds,
        lightweight: true,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new CanvasTasksReadTimeout()),
          READ_TIMEOUT_MS,
        );
      }),
    ]);

    // 仅当本次读到「有进行中任务」时，后台疏导推进（全局单飞 + 每项目节流），不阻塞响应
    const hasInflight = tasks.some((t) => CANVAS_INFLIGHT_STATUS.has(t.status));
    if (hasInflight) scheduleOpportunisticCanvasPoll(projectId);

    return NextResponse.json({ tasks }, { headers: jsonHeaders(request) });
  } catch (err) {
    // 读超时 / DB 不可用：返回 stale，让前端保留上一帧，绝不让画布白屏或 503 卡死。
    // 注意：此时库多半已塞车（连接池耗尽），绝不再起后台轮询火上浇油——
    // 等下一次正常读取再触发疏导。
    if (
      err instanceof CanvasTasksReadTimeout ||
      isPrismaConnectionUnavailable(err)
    ) {
      return NextResponse.json(
        { tasks: null, stale: true },
        { status: 200, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
