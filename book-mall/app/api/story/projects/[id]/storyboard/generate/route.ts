import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireStoryGatewayUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { generateStoryboardForProject } from "@/lib/story/story-storyboard-service";
import { GeminiLlmError } from "@/lib/story/gemini-llm-client";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
/** 5~8 镜分镜 JSON 常需 60s+，避免 Next 提前断连变成 INTERNAL_ERROR */
export const maxDuration = 120;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireStoryGatewayUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const count =
    typeof body.body.count === "number"
      ? body.body.count
      : Number(body.body.count ?? NaN);
  const force = body.body.force === true;

  try {
    const project = await generateStoryboardForProject(guard.user.id, id, {
      count: Number.isFinite(count) ? count : undefined,
      force,
    });
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof GeminiLlmError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return storyErrorToResponse(request, err);
  }
}
