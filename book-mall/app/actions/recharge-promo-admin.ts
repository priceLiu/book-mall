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

function parseIntField(formData: FormData, key: string, opts?: { min?: number }): number {
  const v = formData.get(key);
  const n = v == null || v === "" ? NaN : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`无效整数: ${key}`);
  }
  const min = opts?.min ?? undefined;
  if (min != null && n < min) {
    throw new Error(`${key} 须 ≥ ${min}`);
  }
  return n;
}

function parseOptionalNote(formData: FormData): string | null {
  const v = formData.get("note");
  if (v == null || v === "") return null;
  return String(v);
}

function parseSlug(raw: string): string {
  const s = raw.trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(s)) {
    throw new Error("slug 须为 1～64 位字母、数字、连字符或下划线");
  }
  return s;
}

function parseDatetime(name: string, raw: unknown): Date {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) throw new Error(`请填写 ${name}`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${name} 不是有效时间`);
  }
  return d;
}

export async function createRechargePromoTemplateAction(formData: FormData) {
  await assertAdmin();
  const slug = parseSlug(String(formData.get("slug") ?? ""));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("请填写标题");

  const paidAmountPoints = parseIntField(formData, "paidAmountPoints", { min: 1 });
  const bonusPoints = parseIntField(formData, "bonusPoints", { min: 0 });
  const validDaysAfterClaim = parseIntField(formData, "validDaysAfterClaim", { min: 1 });
  const maxClaimsPerUser = parseIntField(formData, "maxClaimsPerUser", { min: 1 });
  const sortOrder = parseIntField(formData, "sortOrder", { min: 0 });
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  const claimableFrom = parseDatetime("领取开始时间", formData.get("claimableFrom"));
  const claimableTo = parseDatetime("领取结束时间", formData.get("claimableTo"));
  if (claimableTo <= claimableFrom) {
    throw new Error("领取结束须晚于开始");
  }

  await prisma.rechargePromoTemplate.create({
    data: {
      slug,
      title,
      paidAmountPoints,
      bonusPoints,
      active,
      claimableFrom,
      claimableTo,
      validDaysAfterClaim,
      maxClaimsPerUser,
      sortOrder,
      note: parseOptionalNote(formData),
    },
  });

  revalidatePath("/admin/finance/promo-templates");
}

export async function updateRechargePromoTemplateAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("缺少模板 ID");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("请填写标题");

  const paidAmountPoints = parseIntField(formData, "paidAmountPoints", { min: 1 });
  const bonusPoints = parseIntField(formData, "bonusPoints", { min: 0 });
  const validDaysAfterClaim = parseIntField(formData, "validDaysAfterClaim", { min: 1 });
  const maxClaimsPerUser = parseIntField(formData, "maxClaimsPerUser", { min: 1 });
  const sortOrder = parseIntField(formData, "sortOrder", { min: 0 });
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  const claimableFrom = parseDatetime("领取开始时间", formData.get("claimableFrom"));
  const claimableTo = parseDatetime("领取结束时间", formData.get("claimableTo"));
  if (claimableTo <= claimableFrom) {
    throw new Error("领取结束须晚于开始");
  }

  await prisma.rechargePromoTemplate.update({
    where: { id },
    data: {
      title,
      paidAmountPoints,
      bonusPoints,
      active,
      claimableFrom,
      claimableTo,
      validDaysAfterClaim,
      maxClaimsPerUser,
      sortOrder,
      note: parseOptionalNote(formData),
    },
  });

  revalidatePath("/admin/finance/promo-templates");
}

/** slug 创建后不建议改，避免运营口径混乱；若必须改可将来单开迁移动作 */
export async function updateRechargePromoTemplateSlugAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("缺少模板 ID");
  const slug = parseSlug(String(formData.get("slug") ?? ""));

  const existing = await prisma.rechargePromoTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("模板不存在");

  await prisma.rechargePromoTemplate.update({
    where: { id },
    data: { slug },
  });

  revalidatePath("/admin/finance/promo-templates");
}

export async function deleteRechargePromoTemplateAction(templateId: string) {
  await assertAdmin();
  const id = templateId.trim();
  if (!id) throw new Error("缺少模板 ID");

  const issued = await prisma.userRechargeCoupon.count({ where: { templateId: id } });
  if (issued > 0) {
    throw new Error("已有用户领取记录，不能删除模板；请改为「下架」active=false");
  }

  await prisma.rechargePromoTemplate.delete({ where: { id } });
  revalidatePath("/admin/finance/promo-templates");
}
