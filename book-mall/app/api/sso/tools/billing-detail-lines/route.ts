import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichBillingLineToFlatRow } from "@/lib/finance/cloud-bill-enrich";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/**
 * 当前工具 JWT 对应用户的云级账单明细（与 `GET /api/account/billing-detail-lines` 同形）。
 * 供工具站服务端代理；浏览器不直接跨域调 book-mall 本接口。
 */
export async function GET(req: Request) {
  const v = verifyToolsBearer(req);
  if (!v.ok) return v.res;

  const userId = v.userId;

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
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const label = user.name ?? user.email ?? "";
  const rows = lines.map((l) => enrichBillingLineToFlatRow(l, user.id, label));

  return NextResponse.json({
    source: "book-mall",
    user: { id: user.id, name: user.name, email: user.email },
    balancePoints: wallet?.balancePoints ?? 0,
    rows,
  });
}
