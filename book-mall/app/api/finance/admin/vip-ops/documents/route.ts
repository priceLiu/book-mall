import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { listVipDocuments } from "@/lib/finance/vip-ops-service";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务权限");
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId")?.trim() || undefined;
  const ownerUserId = request.nextUrl.searchParams.get("ownerUserId")?.trim() || undefined;

  const documents = await listVipDocuments({ tenantId, ownerUserId });
  return financeJson(request, {
    documents: documents.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}
