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
import {
  adminAdjustVipCredits,
  adminGrantVipTestCredits,
  adminSetMemberMonthlyCap,
} from "@/lib/finance/vip-ops-service";

type RouteContext = { params: { tenantId: string } };

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

const grantSchema = z.object({
  action: z.literal("grant"),
  generalCredits: z.number().int().min(0).optional(),
  videoCredits: z.number().int().min(0).optional(),
  description: z.string().max(200).optional(),
});

const adjustSchema = z.object({
  action: z.literal("adjust"),
  credits: z.number().int(),
  pool: z.enum(["GENERAL", "VIDEO"]).optional(),
  description: z.string().max(200).optional(),
});

const memberCapSchema = z.object({
  action: z.literal("member_cap"),
  memberId: z.string().min(1),
  monthlyCapCredits: z.number().int().min(0).nullable(),
});

const bodySchema = z.discriminatedUnion("action", [
  grantSchema,
  adjustSchema,
  memberCapSchema,
]);

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
    let detail;
    if (parsed.data.action === "grant") {
      detail = await adminGrantVipTestCredits({
        tenantId: params.tenantId,
        generalCredits: parsed.data.generalCredits,
        videoCredits: parsed.data.videoCredits,
        description: parsed.data.description,
        adminUserId: user.id,
      });
    } else if (parsed.data.action === "adjust") {
      detail = await adminAdjustVipCredits({
        tenantId: params.tenantId,
        credits: parsed.data.credits,
        pool: parsed.data.pool,
        description: parsed.data.description,
        adminUserId: user.id,
      });
    } else {
      detail = await adminSetMemberMonthlyCap({
        tenantId: params.tenantId,
        memberId: parsed.data.memberId,
        monthlyCapCredits: parsed.data.monthlyCapCredits,
      });
    }
    return financeJson(request, { ok: true, detail });
  } catch (e) {
    return financeJson(request, { error: (e as Error).message }, { status: 400 });
  }
}
