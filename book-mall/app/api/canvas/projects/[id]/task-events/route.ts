import { type NextRequest } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import {
  CANVAS_TASK_SSE_DB_BACKOFF_MS,
  CANVAS_TASK_SSE_HEARTBEAT_MS,
  CANVAS_TASK_SSE_IDLE_POLL_MS,
  CANVAS_TASK_SSE_POLL_MS,
  getCanvasProjectTaskSyncSnapshot,
  isCanvasTaskSseEnabled,
  resolveCanvasTaskSsePollDelayMs,
} from "@/lib/canvas/canvas-task-event-stream";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** SSE：项目任务指纹变更推送（P3），供侧栏 invalidate + 减少盲轮询。 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const { id: projectId } = await ctx.params;
  try {
    await assertAccessibleCanvasProject(guard.user.id, projectId);
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }

  if (!isCanvasTaskSseEnabled()) {
    return new Response("SSE disabled", { status: 503 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastFingerprint = "";
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pollDelayMs = CANVAS_TASK_SSE_IDLE_POLL_MS;
  let pollFailures = 0;
  let dbBackoffUntil = 0;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      const clearPollTimer = () => {
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      };

      const schedulePoll = (delayMs: number) => {
        clearPollTimer();
        pollTimer = setTimeout(() => {
          void poll();
        }, delayMs);
      };

      const poll = async () => {
        if (closed || request.signal.aborted) return;
        const now = Date.now();
        if (now < dbBackoffUntil) {
          schedulePoll(dbBackoffUntil - now);
          return;
        }
        try {
          const snap = await getCanvasProjectTaskSyncSnapshot(projectId);
          pollFailures = 0;
          pollDelayMs = resolveCanvasTaskSsePollDelayMs(snap);
          if (snap.fingerprint !== lastFingerprint) {
            lastFingerprint = snap.fingerprint;
            send("tasks-changed", { projectId, ...snap });
          }
        } catch {
          pollFailures += 1;
          dbBackoffUntil = Date.now() + CANVAS_TASK_SSE_DB_BACKOFF_MS;
          pollDelayMs = Math.min(
            CANVAS_TASK_SSE_IDLE_POLL_MS * Math.max(pollFailures, 1),
            120_000,
          );
          send("error", { projectId, message: "snapshot_failed" });
        }
        schedulePoll(pollDelayMs);
      };

      send("connected", {
        projectId,
        pollMs: CANVAS_TASK_SSE_POLL_MS,
        idlePollMs: CANVAS_TASK_SSE_IDLE_POLL_MS,
      });
      void poll();

      heartbeatTimer = setInterval(() => {
        send("ping", { t: Date.now() });
      }, CANVAS_TASK_SSE_HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  request.signal.addEventListener("abort", () => {
    closed = true;
    if (pollTimer) clearTimeout(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  });

  return new Response(stream, {
    headers: {
      ...jsonHeaders(request),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
