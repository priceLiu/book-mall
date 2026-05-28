"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("无权限");
}

export async function updateToolServiceFeePlanAction(formData: FormData) {
  await requireAdmin();
  const id = (formData.get("id") as string)?.trim();
  if (!id) throw new Error("缺少 id");

  const monthlyRaw = formData.get("monthlyFeePoints");
  const monthlyFeePoints =
    typeof monthlyRaw === "string" && /^\d+$/.test(monthlyRaw.trim())
      ? parseInt(monthlyRaw.trim(), 10)
      : NaN;
  if (!Number.isFinite(monthlyFeePoints) || monthlyFeePoints < 0) {
    throw new Error("月费点数须为非负整数");
  }

  const active = formData.get("active") === "on" || formData.get("active") === "true";
  const label = (formData.get("label") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;

  await prisma.toolServiceFeePlan.update({
    where: { id },
    data: {
      monthlyFeePoints,
      active,
      ...(label ? { label } : {}),
      note,
    },
  });

  revalidatePath("/admin/tool-service-fee");
}
