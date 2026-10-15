import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  listPlatformAssistantRunHistory,
  type PlatformAssistantRunHistoryFilter,
} from "@/lib/platform-assistant/run-history-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role ?? "").toUpperCase();
  if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return null;
  }
  return session.user;
}

function parseFilter(raw: string | null): PlatformAssistantRunHistoryFilter {
  if (raw === "success" || raw === "failed" || raw === "running") return raw;
  return "all";
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const cursorId = req.nextUrl.searchParams.get("cursor");
  const filter = parseFilter(req.nextUrl.searchParams.get("filter"));

  const { items, nextCursorId } = await listPlatformAssistantRunHistory({
    limit,
    cursorId,
    filter,
  });

  return NextResponse.json({ items, nextCursorId, filter });
}
