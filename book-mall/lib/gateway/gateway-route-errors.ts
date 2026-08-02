import { NextResponse } from "next/server";

import { apiDbUnavailableResponse } from "@/lib/http/api-db-error";
import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";

/** Gateway API · 数据库短暂不可达 → 503 JSON（避免 500 白屏/黑屏） */
export function gatewayDatabaseUnavailableResponse(): NextResponse {
  return apiDbUnavailableResponse(
    new Error("Timed out fetching a new connection from the connection pool"),
  );
}

export function isGatewayDatabaseError(e: unknown): boolean {
  return isPrismaConnectionUnavailable(e);
}
