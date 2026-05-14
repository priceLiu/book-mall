"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { claimRechargeCoupon } from "@/lib/recharge-coupon";

export async function claimRechargePromoTemplateAction(templateId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("请先登录");
  }
  const tid = templateId.trim();
  if (!tid) throw new Error("无效活动");

  await claimRechargeCoupon(session.user.id, tid);

  revalidatePath("/account/recharge-promos");
  revalidatePath("/account");
  revalidatePath("/pay/mock-topup");
}
