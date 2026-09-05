/**
 * 模拟开通 / 运维对齐 / 历史补录：写入已确认的 PaymentCheckout + Order 审计流水。
 * BYOK 产品已退役，此入口仅保留类型导出供历史脚本编译。
 */
export type AdminByokCheckoutSource = "MOCK" | "ADMIN_ALIGN" | "BACKFILL";

export async function recordAdminPaidByokCheckout(_input: {
  userId: string;
  scopeKey: string;
  tenantId?: string | null;
  seats?: number;
  confirmedByUserId: string;
  source: AdminByokCheckoutSource;
  adminNote?: string | null;
  paidAt?: Date;
  subscriptionId?: string | null;
}): Promise<{ checkoutId: string; orderId: string; created: boolean }> {
  throw new Error("BYOK 套餐已退役，无法补录 BYOK 开通流水");
}
