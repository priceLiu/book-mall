import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { createCanvasProjectHistoryForUser } from "@/lib/canvas/canvas-project-history-service";
import {
  getCanvasProjectForUser,
  softDeleteCanvasProjectForUser,
  updateCanvasProjectForUser,
} from "@/lib/canvas/canvas-project-service";
import { pickProjectThumbnailUrl } from "@/lib/canvas/pick-project-thumbnail";
import { scheduleOpportunisticCanvasPoll } from "@/lib/canvas/canvas-task-service";
import { reconcileStaleCanvasMediaRuntimeOnProjectRead } from "@/lib/canvas/canvas-video-display-recover";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const project = await getCanvasProjectForUser(guard.user.id, id);
    void (async () => {
      try {
        const inflight = await prisma.canvasGenerationTask.findFirst({
          where: {
            projectId: id,
            status: { in: ["PENDING", "SUBMITTED"] },
          },
          select: { id: true },
        });
        if (inflight) scheduleOpportunisticCanvasPoll(id);
        await reconcileStaleCanvasMediaRuntimeOnProjectRead(id, project.canvas);
      } catch {
        /* 不阻塞打开画布 */
      }
    })();
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  try {
    const project = await updateCanvasProjectForUser(guard.user.id, id, {
      name: typeof body.body.name === "string" ? body.body.name : undefined,
      description:
        typeof body.body.description === "string"
          ? body.body.description
          : undefined,
      canvas: body.body.canvas,
      thumbnailUrl:
        typeof body.body.thumbnailUrl === "string"
          ? body.body.thumbnailUrl
          : undefined,
    });

    const hs = body.body.historySnapshot;
    let historyItem: Awaited<
      ReturnType<typeof createCanvasProjectHistoryForUser>
    > | null = null;
    if (
      hs &&
      typeof hs === "object" &&
      body.body.canvas !== undefined
    ) {
      const source =
        (hs as { source?: string }).source === "manual"
          ? ("manual" as const)
          : ("autosave" as const);
      const labelRaw = (hs as { label?: unknown }).label;
      try {
        historyItem = await createCanvasProjectHistoryForUser(
          guard.user.id,
          id,
          {
            canvas: project.canvas,
            thumbnailUrl:
              project.thumbnailUrl?.trim() ||
              pickProjectThumbnailUrl(project.canvas) ||
              undefined,
            source,
            label: typeof labelRaw === "string" ? labelRaw : undefined,
          },
        );
      } catch (historyErr) {
        console.warn(
          "[canvas] history snapshot skipped",
          historyErr instanceof Error ? historyErr.message : String(historyErr),
        );
      }
    }

    return NextResponse.json(
      { project, historyItem },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    await softDeleteCanvasProjectForUser(guard.user.id, id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
