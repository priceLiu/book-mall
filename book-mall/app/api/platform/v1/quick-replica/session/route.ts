import { NextResponse } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });

  return NextResponse.json({
    canManageFeatured: canViewFinanceCost(user?.role),
  });
}
