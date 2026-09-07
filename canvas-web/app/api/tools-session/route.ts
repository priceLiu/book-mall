import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { fetchToolsSessionUncachedWithDiag } from "@/lib/tools-introspect";
import type { FetchToolsSessionResult } from "@/lib/tools-introspect";
import { shouldClearToolsTokenOnInactive } from "@/lib/tools-session-inactive-reason";
import {
  isToolsFederatedLogoutRequest,
  respondToolsFederatedLogout,
} from "@/lib/tools-federated-logout";

export const dynamic = "force-dynamic";

/** 同 token 短 TTL 缓存，减轻 layout / 导航时重复 introspect 对 DB 连接池的压力 */
const TOOLS_SESSION_ROUTE_CACHE_MS = 10_000;
let toolsSessionRouteCache: {
  key: string;
  at: number;
  session: FetchToolsSessionResult;
} | null = null;

function toolsSessionRouteCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

function maybeClearToolsTokenCookie(
  res: NextResponse,
  hadToken: boolean,
  session: Awaited<
    ReturnType<typeof fetchToolsSessionUncachedWithDiag>
  >["session"],
): void {
  if (!hadToken || session.active) return;
  if (!shouldClearToolsTokenOnInactive(session)) return;
  res.cookies.set("tools_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  if (isToolsFederatedLogoutRequest(request)) {
    return respondToolsFederatedLogout(request);
  }

  const token = cookies().get("tools_token")?.value;
  const hadToken = Boolean(token?.trim());
  const bearer = token?.trim() ?? "";
  const cacheKey = bearer ? toolsSessionRouteCacheKey(bearer) : "";
  const cached =
    bearer &&
    toolsSessionRouteCache &&
    toolsSessionRouteCache.key === cacheKey &&
    toolsSessionRouteCache.session.active &&
    Date.now() - toolsSessionRouteCache.at < TOOLS_SESSION_ROUTE_CACHE_MS
      ? toolsSessionRouteCache.session
      : null;

  const session = cached ?? (await fetchToolsSessionUncachedWithDiag(token)).session;
  if (!cached && bearer && session.active) {
    toolsSessionRouteCache = { key: cacheKey, at: Date.now(), session };
  } else if (!session.active) {
    toolsSessionRouteCache = null;
  }

  const res = NextResponse.json(session);
  maybeClearToolsTokenCookie(res, hadToken, session);
  return res;
}
