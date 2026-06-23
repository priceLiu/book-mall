import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { AccountButtonSize } from "@/components/account/account-button-sizes";

/** 个人中心主行动：中性 CTA（白/黑，与全站 default 一致） */
export function accountPrimaryButtonClass(size: AccountButtonSize = "sm") {
  return buttonVariants({ variant: "default", size });
}

/** 卡片内 / 段落内链接：中性小按钮 */
export function accountInlineLinkClass(size: AccountButtonSize = "sm") {
  return cn(
    accountPrimaryButtonClass(size),
    "inline-flex shrink-0 items-center no-underline hover:no-underline",
  );
}

/** 段落内纯文字链（非按钮），用于「公示」等说明性跳转 */
export function accountBodyTextLinkClass() {
  return cn(
    "font-medium text-foreground underline underline-offset-2",
    "hover:text-muted-foreground",
  );
}

/** 四宫格卡片主体区：占满剩余高度，把操作区顶到底部 */
export function accountOverviewCardBodyClass() {
  return "flex flex-1 flex-col gap-3";
}

/** 四宫格卡片底部操作区：统一贴底对齐 */
export function accountOverviewCardFooterClass() {
  return "mt-auto flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-t border-transparent pt-3";
}

/** 个人中心侧栏 / 页内导航链接（非 Button） */
export function accountNavLinkClass(active: boolean) {
  return cn(
    "account-nav-item",
    active && "account-nav-item-active",
  );
}

/** 侧栏内「打开子应用」等操作行 */
export function accountNavActionClass(disabled?: boolean) {
  return cn(
    "account-nav-item text-left",
    disabled && "cursor-not-allowed opacity-60",
  );
}
