/** 积分扣费/结算后刷新顶栏余额 */
export const PLATFORM_CREDITS_BALANCE_REFRESH_EVENT =
  "platform:credits-balance-refresh";

export function dispatchCommonToolsCreditsBalanceRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT));
}
