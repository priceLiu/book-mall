import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { submitFrameVideo } from "@/lib/story/story-task-service";
import type { StoryVideoOptions } from "@/lib/story/story-ai-constants";

type RouteCtx = { params: Promise<{ id: string; frameId: string }> };

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, frameId } = await ctx.params;

  // body 可空（默认模型 + 默认参数）。带 body 时校验模型与选项。
  let modelId: string | undefined;
  let options: StoryVideoOptions | undefined;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = (parsed.body ?? {}) as Record<string, unknown>;
    if (typeof body.modelId === "string") {
      modelId = body.modelId;
    }
    if (body.options && typeof body.options === "object") {
      const o = body.options as Record<string, unknown>;
      options = {
        resolution:
          typeof o.resolution === "string" ? o.resolution : undefined,
        duration: typeof o.duration === "number" ? o.duration : undefined,
        generateAudio:
          typeof o.generateAudio === "boolean" ? o.generateAudio : undefined,
        promptExtend:
          typeof o.promptExtend === "boolean" ? o.promptExtend : undefined,
        watermark:
          typeof o.watermark === "boolean" ? o.watermark : undefined,
      };
    }
  }

  try {
    const taskId = await submitFrameVideo(guard.user.id, id, frameId, {
      modelId,
      options,
    });
    return NextResponse.json({ taskId }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
