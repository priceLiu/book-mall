import { NextRequest } from "next/server";
import { z } from "zod";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { getShareRewardConfig } from "@/lib/share/share-reward-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  referralRewardCredits: z.number().int().min(0).max(1000),
  workflowShareRewardCredits: z.number().int().min(0).max(1000),
  shareRewardCreditsExpireDays: z.number().int().min(1).max(365),
  shareRewardDailyCapPerReferrer: z.number().int().min(0).max(100000),
});

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "仅财务管理员可查看");
  }
  const config = await getShareRewardConfig();
  return financeJson(request, { config });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可修改");
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return financeJson(request, { error: "无效 JSON" }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return financeJson(request, { error: parsed.error.flatten() }, { status: 400 });
  }
  await prisma.platformPricingConfig.upsert({
    where: { id: "default" },
    create: { id: "default", ...parsed.data },
    update: parsed.data,
  });
  return financeJson(request, { ok: true });
}
