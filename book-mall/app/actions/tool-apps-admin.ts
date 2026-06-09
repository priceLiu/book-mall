"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { PricingBillingKind } from "@prisma/client";
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

function parseOptionalString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function parseOptionalBillingKind(raw: unknown): PricingBillingKind | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (!(t in PricingBillingKind)) throw new Error(`计费维度无效：${t}`);
  return PricingBillingKind[t as keyof typeof PricingBillingKind];
}

/**
 * v002 P1-2 强约束：服务端永远以 `pricePoints = round(cost × M × 100)` 为准；
 * 前端表单的 `pricePoints` 输入只作为校验时的展示，不写入。
 * 同时禁止 cost = 0（成本必须存在；如想白嫖请直接停用此行）。
 */
function computePricePointsStrict(costYuan: number, mult: number): number {
  if (costYuan === 0) {
    throw new Error("成本（元）= 0 的定价行不允许保存；请取消勾选 `active` 或删除");
  }
  const v = Math.round(costYuan * mult * 100);
  if (!Number.isInteger(v) || v < 1) {
    throw new Error("根据 cost × M 计算出的点数 < 1，请提高成本或系数");
  }
  return v;
}

export async function createToolBillablePrice(_formData: FormData) {
  await assertAdmin();
  throw new Error("ToolBillablePrice 已下线，请在 finance-web「积分定价」维护 ModelCreditPrice");
}

/** @deprecated 财务 2.0：ToolBillablePrice 已退役。 */
export async function updateToolBillablePrice(_formData: FormData) {
  await assertAdmin();
  throw new Error("ToolBillablePrice 已下线，请在 finance-web「积分定价」维护 ModelCreditPrice");
}
