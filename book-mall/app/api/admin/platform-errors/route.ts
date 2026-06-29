import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import type { PlatformErrorSource } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCES: PlatformErrorSource[] = [
  "CANVAS",
  "STORY",
  "GATEWAY",
  "BOOK",
  "TOOL",
  "SYSTEM",
];

function parseSource(raw: string | null): PlatformErrorSource | undefined {
  if (!raw?.trim()) return undefined;
  const u = raw.trim().toUpperCase() as PlatformErrorSource;
  return SOURCES.includes(u) ? u : undefined;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams;
  const source = parseSource(q.get("source"));
  const unresolvedOnly = q.get("unresolved") === "1";
  const code = q.get("code")?.trim() || undefined;
  const take = Math.min(200, Math.max(1, Number(q.get("take") ?? 80) || 80));
  const cursor = q.get("cursor")?.trim() || undefined;

  const rows = await prisma.platformErrorLog.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(unresolvedOnly ? { resolvedAt: null } : {}),
      ...(code ? { code } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({ items, nextCursor });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: { id?: string; resolved?: boolean; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const resolved = body.resolved === true;
  const updated = await prisma.platformErrorLog.update({
    where: { id },
    data: resolved
      ? {
          resolvedAt: new Date(),
          resolvedNote: body.note?.trim() || "已处理",
        }
      : {
          resolvedAt: null,
          resolvedNote: null,
        },
  });

  return NextResponse.json({ item: updated });
}
