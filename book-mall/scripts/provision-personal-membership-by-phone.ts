/**
 * 线下代客开通个人会员（与 /admin/payments 代客确认到账同链路）
 *
 * 用法：
 *   INITIAL_PASSWORD='…' dotenv -e .env.local -- tsx scripts/provision-personal-membership-by-phone.ts 13800138000 …
 *
 * 可选环境变量：
 *   MEMBERSHIP_TIER=标准版（默认，对应 ¥99 月付）
 *   MEMBERSHIP_INTERVAL=MONTH|YEAR（默认 MONTH）
 *   ADMIN_USER_ID=…（默认取首个 ADMIN）
 *   DRY_RUN=1
 */
import bcrypt from "bcryptjs";

import { deriveEcomBillingMode } from "@/lib/billing/billing-persona";
import { createPaymentCheckout } from "@/lib/payments/create-checkout";
import { instantConfirmCheckoutByAdmin } from "@/lib/payments/confirm-checkout";
import { normalizePhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/prisma";

const PHONES = process.argv.slice(2).map((p) => p.trim()).filter(Boolean);
const INITIAL_PASSWORD = process.env.INITIAL_PASSWORD?.trim() ?? "";
const TIER = process.env.MEMBERSHIP_TIER?.trim() || "标准版";
const INTERVAL = (process.env.MEMBERSHIP_INTERVAL?.trim() || "MONTH") as
  | "MONTH"
  | "YEAR";
const DRY_RUN = process.env.DRY_RUN === "1";

async function ensureUserWithPassword(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error(`无效手机号: ${phoneRaw}`);
  if (!INITIAL_PASSWORD || INITIAL_PASSWORD.length < 8) {
    throw new Error("请设置环境变量 INITIAL_PASSWORD（至少 8 位）");
  }

  const verifiedAt = new Date();
  const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 12);
  const billingPersona = "PLATFORM_CREDIT" as const;

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { phone } });
    if (existing) {
      return tx.user.update({
        where: { id: existing.id },
        data: {
          phoneVerifiedAt: verifiedAt,
          passwordHash,
          billingPersona,
          billingPersonaLockedAt: verifiedAt,
          ecomBillingMode: deriveEcomBillingMode(billingPersona),
        },
      });
    }
    const created = await tx.user.create({
      data: {
        phone,
        phoneVerifiedAt: verifiedAt,
        passwordHash,
        billingPersona,
        billingPersonaLockedAt: verifiedAt,
        ecomBillingMode: deriveEcomBillingMode(billingPersona),
      },
    });
    await tx.wallet.create({ data: { userId: created.id } });
    return created;
  });

  return { userId: user.id, phone };
}

async function main() {
  if (PHONES.length === 0) {
    console.error("用法: tsx scripts/provision-personal-membership-by-phone.ts <phone> …");
    process.exit(1);
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: {
      family: "PERSONAL",
      interval: INTERVAL,
      tier: TIER,
      active: true,
    },
  });
  if (!plan) {
    throw new Error(`未找到套餐 PERSONAL / ${INTERVAL} / ${TIER}`);
  }

  const adminId =
    process.env.ADMIN_USER_ID?.trim() ||
    (
      await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })
    )?.id;
  if (!adminId) throw new Error("未找到 ADMIN 用户，请设置 ADMIN_USER_ID");

  console.log(
    JSON.stringify(
      {
        plan: {
          id: plan.id,
          tier: plan.tier,
          interval: plan.interval,
          priceYuan: plan.priceYuan.toString(),
          monthlyCredits: plan.monthlyCredits.toString(),
        },
        adminId,
        dryRun: DRY_RUN,
      },
      null,
      2,
    ),
  );

  for (const raw of PHONES) {
    const { userId, phone } = await ensureUserWithPassword(raw);
    const adminNote = `线下代客开通 ${TIER} ${INTERVAL}（脚本 provision-personal-membership-by-phone）`;

    if (DRY_RUN) {
      console.log(JSON.stringify({ phone, userId, skipped: "DRY_RUN" }));
      continue;
    }

    const checkout = await createPaymentCheckout({
      userId,
      payload: { productKind: "MEMBERSHIP_PERSONAL", planId: plan.id },
      adminNote,
      createdByAdminId: adminId,
    });

    const { orderId } = await instantConfirmCheckoutByAdmin({
      checkoutId: checkout.id,
      confirmedByUserId: adminId,
      adminNote,
    });

    const acc = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
      select: {
        balanceCredits: true,
        membershipPaidUntil: true,
        monthlyGrantCredits: true,
      },
    });

    console.log(
      JSON.stringify({
        ok: true,
        phone,
        userId,
        orderId,
        checkoutId: checkout.id,
        membershipPaidUntil: acc?.membershipPaidUntil?.toISOString() ?? null,
        balanceCredits: acc?.balanceCredits?.toString() ?? null,
        monthlyGrantCredits: acc?.monthlyGrantCredits?.toString() ?? null,
      }),
    );
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
