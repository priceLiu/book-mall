import { NextRequest } from "next/server";

import { canManagePricing } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { autoPublishPlatformOfferings } from "@/lib/platform-model/auto-publish-offerings";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 全量重算平台模型自动上架（最低净成本且过毛利护栏 → ACTIVE） */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅定价管理员可同步自动上架");
  }

  const result = await autoPublishPlatformOfferings({ publishedBy: user.id });
  return financeJson(request, result);
}
