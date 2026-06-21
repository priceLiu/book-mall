import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";

export async function requireFinanceAdminApi(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  if (!canViewFinanceCost(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "需要财务/超管权限" }, { status: 403 }),
    };
  }
  return { ok: true, userId: session.user.id };
}
