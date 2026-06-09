/**
 * 开发环境模拟积分加油包购买（入账 CreditAccount TOPUP 流水）。
 */
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { topupCredits } from "./credit-account-service";
import { packById } from "./credit-topup-packs";
import { canTenant } from "@/lib/tenant/permission";

export type CreditTopupTarget = "personal" | "team";

export async function applyMockCreditTopup(input: {
  userId: string;
  packId: string;
  target: CreditTopupTarget;
  tenantId?: string | null;
}): Promise<{ orderId: string; credits: number; balanceAfter: number }> {
  const pack = packById(input.packId);
  if (!pack) throw new Error("无效的积分包档位");

  let ownerType: "USER" | "TENANT" = "USER";
  let ownerId = input.userId;

  if (input.target === "team") {
    if (!input.tenantId) throw new Error("请选择团队空间");
    const member = await prisma.tenantMember.findFirst({
      where: { userId: input.userId, tenantId: input.tenantId, status: "ACTIVE" },
      include: { tenant: { select: { type: true, status: true } } },
    });
    if (!member || member.tenant.type !== "TEAM" || member.tenant.status !== "ACTIVE") {
      throw new Error("你不是该团队的活跃成员");
    }
    if (!canTenant(member.role, "billing:manage")) {
      throw new Error("仅主账号或管理员可为团队充值");
    }
    ownerType = "TENANT";
    ownerId = input.tenantId;
  }

  const orderId = `mock_credit_topup_${randomUUID()}`;
  const res = await topupCredits({
    ref: { ownerType, ownerId },
    credits: pack.credits,
    pool: pack.pool,
    refType: "mock_topup_order",
    refId: orderId,
    idempotencyKey: orderId,
  });

  return {
    orderId,
    credits: pack.credits,
    balanceAfter: res.balanceAfter,
  };
}
