import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isDbUnavailableError,
  isPrismaConnectionUnavailable,
  prismaConnectionUnavailableMessage,
  toDbUnavailableError,
} from "@/lib/db-unavailable";

export type RouteContext = { params: Record<string, string | string[]> };

export type ApiRouteHandler = (
  req: NextRequest | Request,
  context?: RouteContext,
) => Response | Promise<Response>;

/** API · 数据库短暂不可达 → 503 JSON（避免 500 空 body） */
export function apiDbUnavailableResponse(error?: unknown): NextResponse {
  const e = error ?? new Error("Database unavailable");
  return NextResponse.json(
    {
      error: "SYSTEM_BUSY",
      message: prismaConnectionUnavailableMessage(e),
    },
    { status: 503 },
  );
}

export function tryApiDbUnavailableResponse(error: unknown): NextResponse | null {
  if (!isDbUnavailableError(error) && !isPrismaConnectionUnavailable(error)) {
    return null;
  }
  return apiDbUnavailableResponse(error);
}

/** 包装 Route Handler：连接池/不可达 → 503 SYSTEM_BUSY */
export function withApiDbGuard(handler: ApiRouteHandler): ApiRouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (e) {
      const resp = tryApiDbUnavailableResponse(e);
      if (resp) return resp;
      throw e;
    }
  };
}

/** 供非 Route 代码识别并归一化为 DbUnavailableError */
export function normalizeDbError(error: unknown): DbUnavailableError | null {
  if (isDbUnavailableError(error)) return error;
  if (isPrismaConnectionUnavailable(error)) return toDbUnavailableError(error);
  return null;
}
