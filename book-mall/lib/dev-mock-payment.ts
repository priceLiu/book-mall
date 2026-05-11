/** 是否允许调用开发用模拟支付 API（订阅 / 钱包充值）。 */
export function allowDevMockPaymentApis(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.ALLOW_MOCK_PAYMENT === "true";
}
