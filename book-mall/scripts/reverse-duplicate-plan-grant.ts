/**
 * 冲正重复套餐发放：写 ADJUST 流水扣回多发的积分，不删除原 GRANT 记录。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/reverse-duplicate-plan-grant.ts --email=abc@126.com --checkout-id=cmq860kih000or03c25exs8tt
 *   加 --confirm 写库
 */
import { prisma } from "../lib/prisma";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const email = arg("email")?.trim();
  const checkoutId = arg("checkout-id")?.trim();
  if (!email || !checkoutId) {
    throw new Error("请指定 --email=... --checkout-id=<PaymentCheckout.id>");
  }

  const confirm = hasFlag("confirm");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, billingPersona: true },
  });
  if (!user) throw new Error(`未找到用户 ${email}`);

  const checkout = await prisma.paymentCheckout.findFirst({
    where: { id: checkoutId, userId: user.id },
  });
  if (!checkout) throw new Error(`未找到支付单 ${checkoutId}`);

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: user.id } },
  });
  if (!account) throw new Error("无积分账户");

  const generalGrant = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: `payment_checkout:${checkoutId}` },
  });
  const videoGrant = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: `payment_checkout:${checkoutId}:video` },
  });
  if (!generalGrant || !videoGrant) {
    throw new Error(`支付单 ${checkoutId} 未找到完整 plan_grant 流水`);
  }

  const idemGeneral = `adjust:duplicate_plan_grant:${checkoutId}:general`;
  const idemVideo = `adjust:duplicate_plan_grant:${checkoutId}:video`;

  const existingAdjust = await prisma.creditLedger.findMany({
    where: { idempotencyKey: { in: [idemGeneral, idemVideo] } },
  });
  if (existingAdjust.length === 2) {
    console.log(`[reverse-grant] 已冲正过 ${checkoutId}，跳过`);
    return;
  }
  if (existingAdjust.length === 1) {
    throw new Error("冲正流水不完整，需人工检查");
  }

  const clawGeneral = -generalGrant.credits;
  const clawVideo = -videoGrant.credits;

  console.log(`[reverse-grant] ${confirm ? "执行" : "DRY-RUN"} · ${email}`);
  console.log(`[reverse-grant] 目标支付单 ${checkoutId}（${checkout.status} · ¥${checkout.amountYuan}）`);
  console.log(
    `[reverse-grant] 将冲正：通用 ${clawGeneral} · 视频 ${clawVideo}`,
  );
  console.log(
    `[reverse-grant] 当前余额：通用 ${account.balanceCredits} · 视频 ${account.videoBalanceCredits}`,
  );
  console.log(
    `[reverse-grant] 冲正后约：通用 ${account.balanceCredits + clawGeneral} · 视频 ${account.videoBalanceCredits + clawVideo}`,
  );

  if (!confirm) {
    console.log("[reverse-grant] 预览完成。加 --confirm 执行。");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const acc = await tx.creditAccount.findUniqueOrThrow({ where: { id: account.id } });

    const generalAfter = acc.balanceCredits + clawGeneral;
    const videoAfter = acc.videoBalanceCredits + clawVideo;
    if (generalAfter < 0 || videoAfter < 0) {
      throw new Error("冲正后余额为负，中止");
    }

    await tx.creditLedger.create({
      data: {
        accountId: acc.id,
        type: "ADJUST",
        credits: clawGeneral,
        balanceAfter: generalAfter,
        pool: "GENERAL",
        refType: "duplicate_plan_grant",
        refId: checkoutId,
        idempotencyKey: idemGeneral,
        description: `冲正重复开通发放（支付单 ${checkoutId}）`,
        billingPersonaSnap: user.billingPersona,
      },
    });

    await tx.creditLedger.create({
      data: {
        accountId: acc.id,
        type: "ADJUST",
        credits: clawVideo,
        balanceAfter: videoAfter,
        pool: "VIDEO",
        refType: "duplicate_plan_grant",
        refId: checkoutId,
        idempotencyKey: idemVideo,
        description: `冲正重复开通发放（支付单 ${checkoutId} · 视频池）`,
        billingPersonaSnap: user.billingPersona,
      },
    });

    await tx.creditAccount.update({
      where: { id: acc.id },
      data: {
        balanceCredits: generalAfter,
        videoBalanceCredits: videoAfter,
      },
    });

    const note = `[duplicate-grant-reversed ${new Date().toISOString()}] 重复支付单，积分已冲正`;
    await tx.paymentCheckout.update({
      where: { id: checkoutId },
      data: {
        adminNote: checkout.adminNote ? `${checkout.adminNote}\n${note}` : note,
      },
    });
  });

  console.log(`[reverse-grant] 已完成冲正 ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
