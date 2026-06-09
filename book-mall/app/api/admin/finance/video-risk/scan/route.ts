import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { scanAbnormalUsers } from "@/lib/billing/video-abnormal-scan";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewFinanceCost(session.user.role)) {
    return NextResponse.json({ error: "需要财务管理员权限" }, { status: 403 });
  }
  const users = await scanAbnormalUsers();
  return NextResponse.json({ ok: true, count: users.length, users });
}
