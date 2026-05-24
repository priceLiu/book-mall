import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  scheduleCanvasPollWorkerForProject,
  submitCanvasNodeTask,
} from "@/lib/canvas/canvas-task-service";
import {
  runAiEngineNode,
  runImageEngineNode,
} from "@/lib/canvas/canvas-engine-runner";

type Ctx = { params: Promise<{ id: string; nodeId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId, nodeId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const node = body.body.node as
    | {
        type?: string;
        modelKey?: string;
        data?: Record<string, unknown>;
        imageInputs?: string[];
        textInputs?: string[];
      }
    | undefined;
  if (!node || typeof node.type !== "string") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "body.node.{type,data} required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const forceFresh = body.body.forceFresh === true;
  const baseArgs = {
    userId: guard.user.id,
    projectId,
    nodeId,
    node: {
      type: node.type,
      modelKey: node.modelKey,
      data: (node.data && typeof node.data === "object" ? node.data : {}) as Record<
        string,
        unknown
      >,
      imageInputs: Array.isArray(node.imageInputs)
        ? node.imageInputs.filter((u): u is string => typeof u === "string")
        : [],
      textInputs: Array.isArray(node.textInputs)
        ? node.textInputs.filter((u): u is string => typeof u === "string")
        : [],
    },
  };
  try {
    let result;
    if (node.type === "ai-engine") {
      result = await runAiEngineNode({ ...baseArgs, forceFresh });
    } else if (node.type === "image-engine" || node.type === "three-view-engine") {
      result = await runImageEngineNode({ ...baseArgs, forceFresh });
    } else {
      // v1 兼容：image-gen 仍走旧路径
      result = await submitCanvasNodeTask(baseArgs);
    }
    if (
      result.task.status === "PENDING" ||
      result.task.status === "SUBMITTED"
    ) {
      scheduleCanvasPollWorkerForProject(projectId);
    }
    return NextResponse.json(
      { reused: result.reused, task: result.task },
      { status: result.reused ? 200 : 202, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
