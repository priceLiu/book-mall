import { markBookMallSessionActive } from "@/lib/session-kicked-marker";

/** 登录/注册成功后整页跳转，避免 router.push + refresh 双重 RSC 请求造成的 2～3 秒卡顿。 */
export function navigateAfterAuth(href: string): void {
  markBookMallSessionActive();
  window.location.assign(href);
}
