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
  revalidatePath("/admin/tool-apps/tool-menu");
}

function parseNonnegativeCostYuan(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("成本（元）须为非负数");
  return n;
}

function parsePositiveRetailMultiplier(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("零售系数 M 须为正数");
  return n;
}

export async function createToolBillablePrice(formData: FormData) {
  await assertAdmin();
  const toolKey = String(formData.get("toolKey") ?? "").trim();
  const actionRaw = String(formData.get("action") ?? "").trim();
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const effectiveToRaw = String(formData.get("effectiveTo") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();
  const refModelRaw = String(formData.get("schemeARefModelKey") ?? "").trim();
  const active = formData.get("active") === "on";

  const costYuan = parseNonnegativeCostYuan(formData.get("schemeAUnitCostYuan"));
  const mult = parsePositiveRetailMultiplier(formData.get("schemeAAdminRetailMultiplier"));
  const pricePoints = Math.round(costYuan * mult * 100);
  if (pricePoints < 0 || !Number.isInteger(pricePoints)) throw new Error("点数控件无效");

  if (!toolKey) throw new Error("toolKey 必填");

  const effectiveFrom = parseCnWallDatetimeLocal(effectiveFromRaw);
  const effectiveTo = optionalCnWallEnd(effectiveToRaw);

  await prisma.toolBillablePrice.create({
    data: {
      toolKey,
      action: actionRaw.length > 0 ? actionRaw : null,
      pricePoints,
      effectiveFrom,
      effectiveTo,
      active,
      note: noteRaw.length > 0 ? noteRaw : null,
      schemeARefModelKey: refModelRaw.length > 0 ? refModelRaw : null,
      schemeAUnitCostYuan: costYuan,
      schemeAAdminRetailMultiplier: mult,
    },
  });
  revalidatePath("/admin/tool-apps/manage");
}

/** 更新已有定价行：仅允许修改生效止（避免手改成本/M/点数导致与工具站计算不一致）；调价须「新增定价」建新行。 */
export async function updateToolBillablePrice(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("缺少 id");

  const effectiveToRaw = String(formData.get("effectiveTo") ?? "").trim();
  const effectiveTo = optionalCnWallEnd(effectiveToRaw);

  const existing = await prisma.toolBillablePrice.findUnique({ where: { id } });
  if (!existing) throw new Error("记录不存在");
  if (existing.effectiveTo != null) {
    throw new Error("该行已设置生效止，不可再改；请使用「新增定价」或联系数据库运维。");
  }

  await prisma.toolBillablePrice.update({
    where: { id },
    data: { effectiveTo },
  });
  revalidatePath("/admin/tool-apps/manage");
}
