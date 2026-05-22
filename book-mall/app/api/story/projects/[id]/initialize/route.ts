import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import {
  initializeStoryProject,
  STORY_CHARACTER_COUNT_OPTIONS,
  type StoryCharacterCount,
} from "@/lib/story/story-initializer";
import { GeminiLlmError } from "@/lib/story/gemini-llm-client";

type RouteCtx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

// 初始化阶段需较长时间（LLM 两次调用）：用 Node runtime 而非 Edge，避免边缘函数超时
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  // body 可空（兼容旧调用）；带 characterCount 时校验
  let characterCount: StoryCharacterCount | undefined;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const raw = (parsed.body as { characterCount?: unknown })?.characterCount;
    if (raw !== undefined) {
      const n = Number(raw);
      if (!(STORY_CHARACTER_COUNT_OPTIONS as readonly number[]).includes(n)) {
        return NextResponse.json(
          {
            error: "INVALID_INPUT",
            message: `characterCount must be one of ${STORY_CHARACTER_COUNT_OPTIONS.join(", ")}`,
          },
          { status: 400, headers: jsonHeaders(request) },
        );
      }
      characterCount = n as StoryCharacterCount;
    }
  }

  try {
    const result = await initializeStoryProject(guard.user.id, id, {
      characterCount,
    });
    return NextResponse.json(result, { headers: jsonHeaders(request) });
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
