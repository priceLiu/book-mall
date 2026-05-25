import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storyCorsHeaders } from "@/lib/story/cors";
import { StoryProjectError } from "./story-project-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export function jsonHeaders(request: NextRequest): Record<string, string> {
  return { ...privateHeaders, ...storyCorsHeaders(request) };
}

export function corsOptionsResponse(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: jsonHeaders(request) });
}

export type AuthorizedSessionUser = { id: string; name: string | null; email: string | null };

export type AuthGuardResult =
  | { ok: true; user: AuthorizedSessionUser }
  | { ok: false; response: NextResponse };

/** 校验 NextAuth session；未登录返回 401 响应。 */
export async function requireSessionUser(
  request: NextRequest,
): Promise<AuthGuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: jsonHeaders(request) },
      ),
    };
  }
  return {
    ok: true,
    user: {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    },
  };
}

/** 把 StoryProjectError / 未知错误映射为 NextResponse。 */
export function storyErrorToResponse(
  request: NextRequest,
  err: unknown,
): NextResponse {
  if (err instanceof StoryProjectError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.httpStatus, headers: jsonHeaders(request) },
    );
  }
  // 不向客户端暴露内部错误细节
  console.error("[story-api] unexpected error", err);
  const detail =
    err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
  return NextResponse.json(
    {
      error: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "服务器处理失败，请稍后重试。"
          : detail || "unexpected server error",
    },
    { status: 500, headers: jsonHeaders(request) },
  );
}

/** 解析 JSON body；失败返回 400。 */
export async function readJsonBody(
  request: NextRequest,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400, headers: jsonHeaders(request) },
      ),
    };
  }
}
