"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { activateToolServiceFee } from "@/lib/tool-service-fee/charge-monthly";

export async function activateToolServiceFeeAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("请先登录");

  const toolNavKey = (formData.get("toolNavKey") as string)?.trim();
  if (!toolNavKey) throw new Error("缺少 toolNavKey");

  const result = await activateToolServiceFee(session.user.id, toolNavKey);
  if (!result.ok) {
    if (result.code === "insufficient_balance") {
      throw new Error(
        result.requiredPoints != null
          ? `${result.message}（当前余额不足，请先充值）`
          : result.message,
      );
    }
    throw new Error(result.message);
  }

  revalidatePath("/account");
  revalidatePath("/account/subscription");
  revalidatePath("/account/subscription/tools");
  revalidatePath("/account/tool-service-fee");
}
