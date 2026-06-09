import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { getAuthFromRequest } from "@/lib/auth-from-request";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";
import { enrichBillingLineToFlatRow } from "@/lib/finance/cloud-bill-enrich";
import { applyCanonicalOverlayBatch } from "@/lib/finance/canonical-bill-overlay";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) },
  });
}

/** 管理员查看指定用户的明细行（同源或 CORS + 管理员 Cookie）。 */
export async function GET(request: NextRequest) {
  const headers = { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) };
  const fromReq = await getAuthFromRequest(request);
  const session = await getServerSession(authOptions);
  const viewerId = fromReq?.sub ?? session?.user?.id;
  const viewerRole = fromReq?.role ?? session?.user?.role;
  if (!viewerId || !canViewFinanceCost(viewerRole)) {
    return NextResponse.json({ error: "需要财务/超管权限" }, { status: 403, headers });
  }

  const targetUserId = request.nextUrl.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400, headers });
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404, headers });
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
  const ownedLines = lines.filter((l) => l.userId === targetUserId);
  const baseRows = ownedLines.map((l) => enrichBillingLineToFlatRow(l, user.id, label));
  /** v003：见 account/billing-detail-lines 同名注释——按 catalog 统一厂商列。 */
  const rows = await applyCanonicalOverlayBatch(baseRows);

  return NextResponse.json(
    {
      source: "book-mall-admin",
      user: { id: user.id, name: user.name, email: user.email },
      balancePoints: wallet?.balancePoints ?? 0,
      rows,
    },
    { headers },
  );
}
