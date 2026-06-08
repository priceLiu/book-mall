"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { activateToolServiceFee } from "@/lib/tool-service-fee/charge-monthly";

function redirectWithToolServiceFeeError(message: string): never {
  redirect(
    `/account/tool-service-fee?error=${encodeURIComponent(message)}`,
  );
}

function isMissingToolServiceFeeSchemaError(message: string): boolean {
  return (
    message.includes("ToolServiceFeePlan") ||
    message.includes("UserToolServicePeriod") ||
    message.includes("does not exist") ||
    message.includes("P2021")
  );
}

export async function activateToolServiceFeeAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const toolNavKey = (formData.get("toolNavKey") as string)?.trim();
  if (!toolNavKey) redirectWithToolServiceFeeError("缺少工具分组");

  try {
    const result = await activateToolServiceFee(session.user.id, toolNavKey);
    if (!result.ok) {
      if (result.code === "insufficient_balance") {
        redirectWithToolServiceFeeError(
          result.requiredPoints != null
            ? `${result.message}（当前余额不足，请先充值）`
            : result.message,
        );
      }
      redirectWithToolServiceFeeError(result.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingToolServiceFeeSchemaError(msg)) {
      redirectWithToolServiceFeeError(
        "工具月费数据尚未初始化，请联系管理员在 book-mall 执行 prisma migrate deploy。",
      );
    }
    redirectWithToolServiceFeeError(
      msg.trim() || "开通失败，请稍后重试",
    );
  }

  revalidatePath("/account");
  revalidatePath("/account/subscription");
  revalidatePath("/account/subscription/tools");
  revalidatePath("/account/tool-service-fee");
  redirect("/account/tool-service-fee?success=1");
}
