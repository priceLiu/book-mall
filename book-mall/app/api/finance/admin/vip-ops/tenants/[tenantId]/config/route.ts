import { NextRequest } from "next/server";
import { z } from "zod";

import { canManagePricing } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { adminUpdateVipTenantConfig } from "@/lib/finance/vip-ops-service";

type RouteContext = { params: { tenantId: string } };

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

const bodySchema = z.object({
  seatLimit: z.number().int().min(1).max(999).optional(),
  perSeatCapCredits: z.number().int().min(0).nullable().optional(),
  maxConcurrency: z.number().int().min(1).max(200).optional(),
  name: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可操作");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return financeJson(request, { error: "请求体无效" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return financeJson(request, { error: "参数无效" }, { status: 400 });
  }

  try {
    const detail = await adminUpdateVipTenantConfig({
      tenantId: params.tenantId,
      ...parsed.data,
      adminUserId: user.id,
    });
    return financeJson(request, { ok: true, detail });
  } catch (e) {
    return financeJson(request, { error: (e as Error).message }, { status: 400 });
  }
}
