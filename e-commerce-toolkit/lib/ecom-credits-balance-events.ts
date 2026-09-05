/** 扣费成功后派发，侧栏积分即时刷新（与 canvas-web 事件名一致） */
export const PLATFORM_CREDITS_BALANCE_REFRESH_EVENT =
  "platform:credits-balance-refresh";

export function dispatchEcomCreditsBalanceRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT));
}
