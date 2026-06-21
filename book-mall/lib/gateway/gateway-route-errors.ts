import { NextResponse } from "next/server";

import { isPrismaConnectivityError } from "@/lib/prisma-connectivity";

/** Gateway API · 数据库短暂不可达 → 503 JSON（避免 500 白屏/黑屏） */
export function gatewayDatabaseUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "DATABASE_UNAVAILABLE",
      message:
        "数据库暂不可用（连接超时或连接数已满）。请稍后刷新，或重启 pnpm dev:all；远端 CDB 请检查安全组与最大连接数。",
    },
    { status: 503 },
  );
}

export function isGatewayDatabaseError(e: unknown): boolean {
  return isPrismaConnectivityError(e);
}
