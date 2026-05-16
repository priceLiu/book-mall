import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { enrichBillingLineToFlatRow } from "@/lib/finance/cloud-bill-enrich";

function resolveViewerUserId(request: NextRequest, sessionUserId: string | undefined): string | null {
  if (sessionUserId) return sessionUserId;
  const devOk = process.env.FINANCE_ALLOW_DEV_USER_QUERY === "1" && process.env.NODE_ENV !== "production";
  if (!devOk) return null;
  return request.nextUrl.searchParams.get("devUserId");
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: financeCorsHeaders(request) });
}

/**
 * 当前登录用户的财务明细（与 `ToolBillingDetailLine` 对齐云 CSV 颗粒度）。
 * - 正常：依赖 NextAuth Cookie（建议在 book-mall 同域打开 finance-web，或配置跨站 Cookie / 反向代理）。
 * - 本地开发：可设 `FINANCE_ALLOW_DEV_USER_QUERY=1` 且带 `?devUserId=<book-mall User.id>`（仅非 production）。
 */
export async function GET(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  const userId = resolveViewerUserId(request, session?.user?.id);
  if (!userId) {
    return NextResponse.json(
      { error: "未登录", hint: "开发可设 FINANCE_ALLOW_DEV_USER_QUERY=1 并传 devUserId" },
      { status: 401, headers: cors },
    );
  }

  const [user, wallet, lines] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    }),
    prisma.wallet.findUnique({
      where: { userId },
      select: { balancePoints: true },
    }),
    prisma.toolBillingDetailLine.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: cors });
  }

  const label = user.name ?? user.email ?? "";
  const rows = lines.map((l) => enrichBillingLineToFlatRow(l, user.id, label));

  return NextResponse.json(
    {
      source: "book-mall",
      user: { id: user.id, name: user.name, email: user.email },
      balancePoints: wallet?.balancePoints ?? 0,
      rows,
    },
    { headers: cors },
  );
}
