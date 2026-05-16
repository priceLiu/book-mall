import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { enrichBillingLineToFlatRow } from "@/lib/finance/cloud-bill-enrich";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: financeCorsHeaders(request) });
}

/** 管理员查看指定用户的明细行（同源或 CORS + 管理员 Cookie）。 */
export async function GET(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers: cors });
  }

  const targetUserId = request.nextUrl.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400, headers: cors });
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: cors });
  }

  const [wallet, lines] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: targetUserId },
      select: { balancePoints: true },
    }),
    prisma.toolBillingDetailLine.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const label = user.name ?? user.email ?? "";
  const rows = lines.map((l) => enrichBillingLineToFlatRow(l, user.id, label));

  return NextResponse.json(
    {
      source: "book-mall-admin",
      user: { id: user.id, name: user.name, email: user.email },
      balancePoints: wallet?.balancePoints ?? 0,
      rows,
    },
    { headers: cors },
  );
}
