import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";
import { enrichBillingLineToFlatRow } from "@/lib/finance/cloud-bill-enrich";
import { applyCanonicalOverlayBatch } from "@/lib/finance/canonical-bill-overlay";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

function withBillingPrivacyHeaders(res: NextResponse): NextResponse {
  const h = new Headers(res.headers);
  for (const [key, val] of Object.entries(billingPrivateCacheHeaders("Authorization"))) {
    h.set(key, val);
  }
  return new NextResponse(res.body, { status: res.status, headers: h });
}

/**
 * 当前工具 JWT 对应用户的云级账单明细（与 `GET /api/account/billing-detail-lines` 同形）。
 * 供工具站服务端代理；浏览器不直接跨域调 book-mall 本接口。
 */
export async function GET(req: Request) {
  const v = verifyToolsBearer(req);
  if (!v.ok) return withBillingPrivacyHeaders(v.res);

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
      // 与 `/api/account/billing-detail-lines` 一致：仅工具站产生的扣费行（非云 CSV 导入对账行）
      where: { userId, source: "TOOL_USAGE_GENERATED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    return NextResponse.json(
      { error: "用户不存在" },
      { status: 404, headers: billingPrivateCacheHeaders("Authorization") },
    );
  }

  const label = user.name ?? user.email ?? "";
  const ownedLines = lines.filter((l) => l.userId === userId);
  const baseRows = ownedLines.map((l) => enrichBillingLineToFlatRow(l, user.id, label));
  /** v003：见 account/billing-detail-lines——按 catalog 把两类行的厂商列统一覆写。 */
  const rows = await applyCanonicalOverlayBatch(baseRows);

  return NextResponse.json(
    {
      source: "book-mall",
      user: { id: user.id, name: user.name, email: user.email },
      balancePoints: wallet?.balancePoints ?? 0,
      rows,
    },
    { headers: billingPrivateCacheHeaders("Authorization") },
  );
}
