/**
 * 统一积分计费总开关（gateway-multi-credential-and-tenant · 里程碑 4）
 *
 * 默认开启：生成成功后按积分结算，旧钱包扣点路径自动收敛（互斥，避免双扣）。
 * 设 `CREDIT_BILLING_OFF=1` 可整体回退到旧钱包扣点体系。
 */
export function isUnifiedCreditBillingActive(): boolean {
  return process.env.CREDIT_BILLING_OFF !== "1";
}
