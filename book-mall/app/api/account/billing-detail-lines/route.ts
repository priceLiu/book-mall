import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth-from-request";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";
import { enrichBillingLineToFlatRow } from "@/lib/finance/cloud-bill-enrich";
import { applyCanonicalOverlayBatch } from "@/lib/finance/canonical-bill-overlay";

function resolveViewerUserId(request: NextRequest, sessionUserId: string | undefined): string | null {
  if (sessionUserId) return sessionUserId;
  /** 生产环境禁止 ?devUserId= 回退（即使误配 FINANCE_ALLOW_DEV_USER_QUERY）。 */
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.FINANCE_ALLOW_DEV_USER_QUERY !== "1") return null;
  return request.nextUrl.searchParams.get("devUserId");
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) },
  });
}

/**
 * 当前登录用户的财务明细（与 `ToolBillingDetailLine` 对齐云 CSV 颗粒度）。
 * - 正常：依赖 NextAuth Cookie（建议在 book-mall 同域打开 finance-web，或配置跨站 Cookie / 反向代理）。
 * - 本地开发：可设 `FINANCE_ALLOW_DEV_USER_QUERY=1` 且带 `?devUserId=<book-mall User.id>`（仅非 production）。
 */
export async function GET(request: NextRequest) {
  const headers = { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) };
  const fromReq = await getAuthFromRequest(request);
  const sessionUserId =
    fromReq?.sub ?? (await getServerSession(authOptions))?.user?.id ?? undefined;
  /** 有主站会话则永远优先会话；无会话时仅在非 production + FINANCE_ALLOW_DEV_USER_QUERY 下才可能用 ?devUserId= */
  const viewerAuthMode: "session" | "dev_user_id" = sessionUserId ? "session" : "dev_user_id";
  const userId = resolveViewerUserId(request, sessionUserId);
  if (!userId) {
    return NextResponse.json(
      { error: "未登录", hint: "开发可设 FINANCE_ALLOW_DEV_USER_QUERY=1 并传 devUserId" },
      { status: 401, headers },
    );
  }

  const [user, wallet, lines] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    }),
    prisma.wallet.findUnique({
      where: { userId },
      select: { balancePoints: true },
    }),
    prisma.toolBillingDetailLine.findMany({
      // v006 Round 4：`/api/account` 仅展示当前会员自己的工具站调用记录（TOOL_USAGE_GENERATED）；
      // CLOUD_CSV_IMPORT 是平台拉到的云厂商账单 raw 行，**仅 admin** 视角对账可见。
      where: { userId, source: "TOOL_USAGE_GENERATED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404, headers });
  }

  /** 双保险：仅序列化 viewer 本人行，避免 ORM/数据异常时越权展示。 */
  const ownedLines = lines.filter((l) => l.userId === userId);
  const label = user.name ?? user.phone ?? user.email ?? "";
  const baseRows = ownedLines.map((l) => enrichBillingLineToFlatRow(l, user.id, label));
  /**
   * v003：用 ModelCatalog/ModelAlias 把两类行（TOOL_USAGE_GENERATED / CLOUD_CSV_IMPORT）
   * 的"产品名称 / 商品名称 / 规格"统一覆写为 canonical，确保头部统计与厂商列筛选一致。
   * 校准未配置时 lookup 为空，行内容保持原样（向后兼容）。
   */
  const rows = await applyCanonicalOverlayBatch(baseRows);

  return NextResponse.json(
    {
      source: "book-mall",
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      balancePoints: wallet?.balancePoints ?? 0,
      rows,
      viewer: { authMode: viewerAuthMode },
    },
    { headers },
  );
}
