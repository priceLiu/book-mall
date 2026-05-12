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

function parseCnWallDatetimeLocal(s: string): Date {
  const t = s.trim();
  if (!t) throw new Error("时间为空");
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (!m) throw new Error("时间格式应为 YYYY-MM-DDTHH:mm（北京时间）");
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00`);
}

function optionalCnWallEnd(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  return parseCnWallDatetimeLocal(t);
}

/** 菜单项是否在工具站侧栏展示 */
export async function updateToolNavVisibility(formData: FormData) {
  await assertAdmin();
  const navKey = String(formData.get("navKey") ?? "").trim();
  if (!navKey) throw new Error("缺少 navKey");
  const visible = formData.get("visible") === "on";

  await prisma.toolNavVisibility.update({
    where: { navKey },
    data: { visible },
  });
  revalidatePath("/admin/tool-apps/manage");
}

/** 新增一条按次单价（分） */
export async function createToolBillablePrice(formData: FormData) {
  await assertAdmin();
  const toolKey = String(formData.get("toolKey") ?? "").trim();
  const actionRaw = String(formData.get("action") ?? "").trim();
  const yuan = Number(formData.get("priceYuan"));
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const effectiveToRaw = String(formData.get("effectiveTo") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!toolKey) throw new Error("toolKey 必填");
  if (!Number.isFinite(yuan) || yuan < 0) throw new Error("单价（元）无效");
  const priceMinor = Math.round(yuan * 100);
  if (priceMinor < 0 || !Number.isInteger(priceMinor)) throw new Error("单价换算分无效");

  const effectiveFrom = parseCnWallDatetimeLocal(effectiveFromRaw);
  const effectiveTo = optionalCnWallEnd(effectiveToRaw);

  await prisma.toolBillablePrice.create({
    data: {
      toolKey,
      action: actionRaw.length > 0 ? actionRaw : null,
      priceMinor,
      effectiveFrom,
      effectiveTo,
      active,
      note: noteRaw.length > 0 ? noteRaw : null,
    },
  });
  revalidatePath("/admin/tool-apps/manage");
}

/** 更新已有定价行（仅改单价、区间、启用与备注） */
export async function updateToolBillablePrice(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("缺少 id");

  const yuan = Number(formData.get("priceYuan"));
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const effectiveToRaw = String(formData.get("effectiveTo") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!Number.isFinite(yuan) || yuan < 0) throw new Error("单价（元）无效");
  const priceMinor = Math.round(yuan * 100);
  if (priceMinor < 0 || !Number.isInteger(priceMinor)) throw new Error("单价换算分无效");

  const effectiveFrom = parseCnWallDatetimeLocal(effectiveFromRaw);
  const effectiveTo = optionalCnWallEnd(effectiveToRaw);

  await prisma.toolBillablePrice.update({
    where: { id },
    data: {
      priceMinor,
      effectiveFrom,
      effectiveTo,
      active,
      note: noteRaw.length > 0 ? noteRaw : null,
    },
  });
  revalidatePath("/admin/tool-apps/manage");
}
