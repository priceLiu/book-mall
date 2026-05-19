import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";

/**
 * finance-web 跨源读取「当前浏览器在 book-mall 的登录态」（含 role）。
 * 与 `/api/auth/session` 同源信息，但附带 FINANCE_WEB_ORIGINS CORS。
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) },
  });
}

export async function GET(request: NextRequest) {
  const base = {
    ...billingPrivateCacheHeaders("Cookie"),
    ...financeCorsHeaders(request),
  };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ user: null as null }, { headers: base });
  }
  const { id, email, name, role } = session.user;
  return NextResponse.json(
    {
      user: {
        id,
        email: email ?? null,
        name: name ?? null,
        role,
      },
    },
    { headers: base },
  );
}
