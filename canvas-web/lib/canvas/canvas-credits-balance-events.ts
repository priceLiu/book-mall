/** 积分扣费/结算后刷新余额（画布 run-queue · 各门户余额条监听） */
export const PLATFORM_CREDITS_BALANCE_REFRESH_EVENT =
  "platform:credits-balance-refresh";

export function dispatchPlatformCreditsBalanceRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT),
  );
}
