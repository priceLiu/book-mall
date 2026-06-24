import { NextResponse } from "next/server";

import { prismaConnectionUnavailableMessage } from "@/lib/db-unavailable";
import { isPrismaConnectivityError } from "@/lib/prisma-connectivity";

/** Gateway API · 数据库短暂不可达 → 503 JSON（避免 500 白屏/黑屏） */
export function gatewayDatabaseUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "DATABASE_UNAVAILABLE",
      message: prismaConnectionUnavailableMessage(
        new Error("Timed out fetching a new connection from the connection pool"),
      ),
    },
    { status: 503 },
  );
}

export function isGatewayDatabaseError(e: unknown): boolean {
  return isPrismaConnectivityError(e);
}
