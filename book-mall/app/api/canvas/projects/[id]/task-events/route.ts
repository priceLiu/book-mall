import { type NextRequest } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import {
  CANVAS_TASK_SSE_HEARTBEAT_MS,
  CANVAS_TASK_SSE_POLL_MS,
  getCanvasProjectTaskSyncSnapshot,
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

  const encoder = new TextEncoder();
  let closed = false;
  let lastFingerprint = "";
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      const poll = async () => {
        if (closed || request.signal.aborted) return;
        try {
          const snap = await getCanvasProjectTaskSyncSnapshot(projectId);
          if (snap.fingerprint !== lastFingerprint) {
            lastFingerprint = snap.fingerprint;
            send("tasks-changed", { projectId, ...snap });
          }
        } catch {
          send("error", { projectId, message: "snapshot_failed" });
        }
      };

      send("connected", { projectId });
      void poll();

      pollTimer = setInterval(() => {
        void poll();
      }, CANVAS_TASK_SSE_POLL_MS);

      heartbeatTimer = setInterval(() => {
        send("ping", { t: Date.now() });
      }, CANVAS_TASK_SSE_HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  request.signal.addEventListener("abort", () => {
    closed = true;
    if (pollTimer) clearInterval(pollTimer);
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
