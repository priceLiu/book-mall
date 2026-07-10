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
import { provisionVipPackage } from "@/lib/finance/vip-package-service";
import { resolveFinanceUserByPhone } from "@/lib/finance/vip-ops-service";

export const dynamic = "force-dynamic";

const seatPlanSchema = z.object({
  phone: z.string().optional().nullable(),
  role: z.enum(["OWNER", "MEMBER"]).optional(),
  generalCredits: z.number().int().min(0),
  videoCredits: z.number().int().min(0),
  label: z.string().max(32).optional().nullable(),
});

const bodySchema = z.object({
  ownerUserId: z.string().min(1).optional(),
  ownerPhone: z.string().min(1).optional(),
  teamName: z.string().min(1).max(64),
  amountYuan: z.number().positive(),
  targetMargin: z.number().min(0).max(0.99),
  scheme: z.enum(["general_heavy", "video_heavy"]),
  videoFraction: z.number().min(0).max(1),
  seats: z.number().int().min(1).max(1000),
  allocationMode: z.enum(["auto", "manual"]).optional(),
  seatPlans: z.array(seatPlanSchema).optional(),
  sendInvites: z.boolean().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：开通 VIP 大额套餐（创建团队租户 + 发放双池积分）。仅财务管理员。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可开通 VIP 套餐");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return financeJson(request, { error: "请求体无效" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return financeJson(
      request,
      { error: "参数无效", detail: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let ownerUserId = parsed.data.ownerUserId?.trim() || "";
  const ownerPhone = parsed.data.ownerPhone?.trim() || "";
  if (!ownerUserId && ownerPhone) {
    const resolved = await resolveFinanceUserByPhone(ownerPhone);
    if (!resolved) {
      return financeJson(request, { error: "未找到该手机号对应用户，请先注册主账号" }, { status: 400 });
    }
    ownerUserId = resolved.id;
  }
  if (!ownerUserId) {
    return financeJson(request, { error: "请填写客户手机号或 ownerUserId" }, { status: 400 });
  }

  const result = await provisionVipPackage({
    ...parsed.data,
    ownerUserId,
    ownerPhone: ownerPhone || null,
    adminUserId: user.id,
  });
  if (!result.ok) {
    return financeJson(request, { error: result.reason }, { status: 400 });
  }
  return financeJson(request, { ...result });
}
