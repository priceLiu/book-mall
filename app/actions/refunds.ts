"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("无权操作");
  }
}

/** 完成余额退款：从钱包扣减 refundAmount，记流水；应扣未扣从额度中扣除 */
export async function completeWalletRefund(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const pendingRaw = formData.get("pendingSettlementMinor");
  const pendingSettlementMinor =
    pendingRaw == null || pendingRaw === ""
      ? 0
      : Number(pendingRaw);
  const overrideRaw = formData.get("refundAmountMinorOverride");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;

  if (!id || !Number.isFinite(pendingSettlementMinor) || pendingSettlementMinor < 0) {
    throw new Error("无效的应扣未扣");
  }
  if (!Number.isInteger(pendingSettlementMinor)) {
    throw new Error("应扣未扣须为整数（分）");
  }

  await prisma.$transaction(async (tx) => {
    const req = await tx.walletRefundRequest.findUnique({
      where: { id },
      include: { user: { include: { wallet: true } } },
    });
    if (!req || req.status !== "PENDING") throw new Error("申请不存在或已处理");
    const wallet = req.user.wallet;
    if (!wallet) throw new Error("用户无钱包");

    const requested =
      req.requestedAmountMinor ?? wallet.balanceMinor;
    const cap = Math.min(requested, wallet.balanceMinor);
    let refundAmount = cap - pendingSettlementMinor;
    if (overrideRaw != null && String(overrideRaw) !== "") {
      const o = Number(overrideRaw);
      if (!Number.isInteger(o) || o < 0) throw new Error("退款金额覆盖值无效");
      refundAmount = o;
    }
    if (refundAmount <= 0) throw new Error("核算后无可退金额");
    if (refundAmount > wallet.balanceMinor) {
      throw new Error("退款额超过可用余额");
    }

    const newBal = wallet.balanceMinor - refundAmount;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: newBal },
    });
    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "REFUND",
        amountMinor: -refundAmount,
        balanceAfterMinor: newBal,
        description: `余额退款核准（应扣未扣 ${pendingSettlementMinor} 分）${adminNote ? ` — ${adminNote}` : ""}`,
      },
    });
    await tx.walletRefundRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        pendingSettlementMinor,
        refundAmountMinor: refundAmount,
        adminNote,
        decidedAt: new Date(),
      },
    });
  });

  revalidatePath("/admin/refunds");
  revalidatePath("/account");
}

export async function rejectWalletRefund(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!id) throw new Error("缺少 id");

  await prisma.walletRefundRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "REJECTED",
      adminNote,
      decidedAt: new Date(),
    },
  });
  revalidatePath("/admin/refunds");
  revalidatePath("/account");
}

export async function createSubscriptionRefundRequest(formData: FormData) {
  await assertAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) throw new Error("缺少订单");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  if (!order || order.type !== "SUBSCRIPTION") throw new Error("仅支持订阅类订单");
  if (order.status !== "PAID") throw new Error("订单未支付");
  if (order.refundedAt) throw new Error("该订单已退款");

  const existing = await prisma.subscriptionRefundRequest.findFirst({
    where: { orderId, status: "PENDING" },
  });
  if (existing) throw new Error("已存在待审核的订阅退款");

  const meta = order.meta as { subscriptionId?: string } | null;
  const subscriptionId =
    typeof meta?.subscriptionId === "string" ? meta.subscriptionId : null;

  await prisma.subscriptionRefundRequest.create({
    data: {
      userId: order.userId,
      orderId: order.id,
      subscriptionId,
      status: "PENDING",
    },
  });
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/billing");
}

export async function completeSubscriptionRefund(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!id) throw new Error("缺少 id");

  await prisma.$transaction(async (tx) => {
    const req = await tx.subscriptionRefundRequest.findUnique({
      where: { id },
    });
    if (!req || req.status !== "PENDING") throw new Error("记录不存在或已处理");
    if (!req.orderId) throw new Error("缺少关联订单");

    const order = await tx.order.findUnique({ where: { id: req.orderId } });
    if (!order || order.refundedAt) throw new Error("订单状态异常");

    if (req.subscriptionId) {
      await tx.subscription.updateMany({
        where: { id: req.subscriptionId, userId: req.userId },
        data: { status: "EXPIRED" },
      });
    } else {
      await tx.subscription.updateMany({
        where: { userId: req.userId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
    }

    await tx.order.update({
      where: { id: req.orderId },
      data: { refundedAt: new Date() },
    });

    await tx.subscriptionRefundRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        adminNote,
        decidedAt: new Date(),
      },
    });
  });

  revalidatePath("/admin/refunds");
  revalidatePath("/admin/billing");
}

export async function rejectSubscriptionRefund(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!id) throw new Error("缺少 id");

  await prisma.subscriptionRefundRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "REJECTED",
      adminNote,
      decidedAt: new Date(),
    },
  });
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/billing");
}
