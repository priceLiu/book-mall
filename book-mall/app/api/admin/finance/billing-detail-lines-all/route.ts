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

const DEFAULT_TAKE = 1000;
const MAX_TAKE = 5000;

/**
 * 管理员 · 全部用户费用明细汇总。
 *
 * 与单用户接口 `/api/admin/finance/billing-detail-lines?userId=X` 数据口径完全一致：
 *   - 同样的 enrich：cloudRow JSON → 32 列扁平 row；
 *   - 同样的 canonical overlay：把 CSV 行也补齐「平台/产品Code/名称/计费项Code」；
 *   - 行内已带「平台/用户ID + 平台/用户名」，前端可直接当索引列展示。
 *
 * 查询参数：
 *   - `from`、`to`：ISO 日期范围（按 `ToolBillingDetailLine.createdAt` 过滤），可缺省。
 *   - `take`：单次最多返回行数（默认 1000，上限 5000）。
 *   - `userId`：可选，留作「再过滤回单用户」用——一般用 single-user 接口替代。
 *
 * 安全：必须 ADMIN 角色（同 single-user 接口）。
 */
export async function GET(request: NextRequest) {
  const headers = { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) };
  const fromReq = await getAuthFromRequest(request);
  const session = await getServerSession(authOptions);
  const viewerId = fromReq?.sub ?? session?.user?.id;
  const viewerRole = fromReq?.role ?? session?.user?.role;
  if (!viewerId || !canViewFinanceCost(viewerRole)) {
    return NextResponse.json({ error: "需要财务/超管权限" }, { status: 403, headers });
  }

  const sp = request.nextUrl.searchParams;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  const userIdFilter = sp.get("userId")?.trim() || null;
  const takeRaw = parseInt(sp.get("take") || "", 10);
  const take = Number.isFinite(takeRaw)
    ? Math.min(MAX_TAKE, Math.max(1, takeRaw))
    : DEFAULT_TAKE;

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (fromStr) {
    const d = new Date(fromStr);
    if (Number.isFinite(d.getTime())) createdAt.gte = d;
  }
  if (toStr) {
    const d = new Date(toStr);
    if (Number.isFinite(d.getTime())) createdAt.lte = d;
  }

  const where: Record<string, unknown> = {};
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  if (userIdFilter) where.userId = userIdFilter;

  const lines = await prisma.toolBillingDetailLine.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  const baseRows = lines.map((l) =>
    enrichBillingLineToFlatRow(l, l.user.id, l.user.name ?? l.user.email ?? ""),
  );
  const rows = await applyCanonicalOverlayBatch(baseRows);

  const totalCount = await prisma.toolBillingDetailLine.count({ where });

  return NextResponse.json(
    {
      source: "book-mall-admin-all",
      rows,
      total: totalCount,
      returned: rows.length,
      take,
      truncated: rows.length < totalCount,
      filter: { from: fromStr, to: toStr, userId: userIdFilter },
    },
    { headers },
  );
}
