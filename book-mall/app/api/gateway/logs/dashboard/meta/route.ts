import { NextResponse, type NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import { formatUserDisplayLabel } from "@/lib/auth/user-display";
import { listDashboardTeamOptions } from "@/lib/gateway/log-dashboard-teams";
import { resolveGatewaySessionBookUserId } from "@/lib/gateway/log-query-scope";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const bookUserId = await resolveGatewaySessionBookUserId({
    id: user.id,
    bookUserId: user.bookUserId,
    email: user.email,
  });

  const bookUser = bookUserId
    ? await prisma.user.findUnique({
        where: { id: bookUserId },
        select: { role: true, phone: true, name: true, email: true },
      })
    : null;
  const isPlatformAdmin = canViewFinanceCost(bookUser?.role);

  const teams =
    bookUserId != null
      ? await listDashboardTeamOptions(bookUserId, { isPlatformAdmin })
      : [];

  return NextResponse.json({
    isPlatformAdmin,
    bookUserId,
    currentUser: bookUserId
      ? {
          id: bookUserId,
          phone: bookUser?.phone ?? null,
          name: bookUser?.name ?? null,
          displayLabel: formatUserDisplayLabel({
            id: bookUserId,
            name: bookUser?.name,
            phone: bookUser?.phone,
            email: bookUser?.email,
          }),
        }
      : null,
    teams,
  });
}
