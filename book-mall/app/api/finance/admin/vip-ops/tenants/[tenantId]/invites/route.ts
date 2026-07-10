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
  adminCreateVipInvite,
  adminResolveVipInviteLink,
} from "@/lib/finance/vip-ops-service";

type RouteContext = { params: { tenantId: string } };

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

const createSchema = z.object({
  action: z.literal("create"),
  phone: z.string().min(1),
  plannedGeneralCredits: z.number().int().min(0).optional().nullable(),
  plannedVideoCredits: z.number().int().min(0).optional().nullable(),
});

const linkSchema = z.object({
  action: z.literal("link"),
  inviteId: z.string().min(1),
});

const bodySchema = z.discriminatedUnion("action", [createSchema, linkSchema]);

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可发送邀请");
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
    if (parsed.data.action === "create") {
      const result = await adminCreateVipInvite({
        tenantId: params.tenantId,
        phone: parsed.data.phone,
        plannedGeneralCredits: parsed.data.plannedGeneralCredits,
        plannedVideoCredits: parsed.data.plannedVideoCredits,
        adminUserId: user.id,
      });
      return financeJson(request, { ok: true, inviteUrl: result.inviteUrl, detail: result.detail });
    }
    const result = await adminResolveVipInviteLink({
      tenantId: params.tenantId,
      inviteId: parsed.data.inviteId,
    });
    return financeJson(request, { ok: true, inviteUrl: result.inviteUrl });
  } catch (e) {
    return financeJson(request, { error: (e as Error).message }, { status: 400 });
  }
}
