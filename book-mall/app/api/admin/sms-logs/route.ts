import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma, SmsSendStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES: SmsSendStatus[] = ["SUCCESS", "MOCK", "FAILED", "RATE_LIMITED"];

function parseStatus(raw: string | null): SmsSendStatus | undefined {
  if (!raw?.trim()) return undefined;
  const u = raw.trim().toUpperCase() as SmsSendStatus;
  return STATUSES.includes(u) ? u : undefined;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams;
  const status = parseStatus(q.get("status"));
  const source = q.get("source")?.trim() || undefined;
  const phone = q.get("phone")?.trim() || undefined;
  const take = Math.min(200, Math.max(1, Number(q.get("take") ?? 80) || 80));
  const cursor = q.get("cursor")?.trim() || undefined;

  const where: Prisma.SmsSendLogWhereInput = {
    ...(status ? { status } : {}),
    ...(source ? { source: { contains: source, mode: "insensitive" } } : {}),
    ...(phone ? { phone: { contains: phone.replace(/\D/g, "") } } : {}),
  };

  const [rows, total24h, failed24h] = await Promise.all([
    prisma.smsSendLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.smsSendLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.smsSendLog.count({
      where: {
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({
    items,
    nextCursor,
    stats: { total24h, failed24h },
  });
}
