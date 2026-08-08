/** 积分扣费/结算后刷新各门户余额条 */
export const PLATFORM_CREDITS_BALANCE_REFRESH_EVENT =
  "platform:credits-balance-refresh";

export function dispatchPlatformCreditsBalanceRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT),
  );
}
