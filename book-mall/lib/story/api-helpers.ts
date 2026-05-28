import { type NextRequest, NextResponse } from "next/server";
import { resolvePlatformUser } from "@/lib/platform-auth";
import { storyCorsHeaders } from "@/lib/story/cors";
import {
  assertGatewayApiKeyLinkedForUser,
  GatewayRequiredError,
} from "@/lib/gateway/book-gateway-link";
import {
  assertPlatformGatewayEntitlement,
  PlatformEntitlementError,
} from "@/lib/platform-gateway-entitlement";
import { StoryProjectError } from "./story-project-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
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
  const user = await resolvePlatformUser(request);
  if (!user) {
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
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

/** Story AI 路由：登录 + 漫剧月费 + Gateway Key */
export async function requireStoryGatewayUser(
  request: NextRequest,
): Promise<AuthGuardResult> {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard;
  try {
    await assertPlatformGatewayEntitlement(guard.user.id, {
      navKey: "story-theater",
    });
    await assertGatewayApiKeyLinkedForUser(guard.user.id);
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: e.code, message: e.message },
          { status: e.httpStatus, headers: jsonHeaders(request) },
        ),
      };
    }
    if (e instanceof GatewayRequiredError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: e.code, message: e.message },
          { status: e.httpStatus, headers: jsonHeaders(request) },
        ),
      };
    }
    throw e;
  }
  return guard;
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
