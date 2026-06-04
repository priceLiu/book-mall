import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { AccountButtonSize } from "@/components/account/account-button-sizes";

/** 个人中心主行动：统一橙色按钮（仅 sm | md | lg） */
export function accountPrimaryButtonClass(size: AccountButtonSize = "sm") {
  return buttonVariants({ variant: "subscription", size });
}

/** 卡片内 / 段落内链接：橙色小按钮（替代蓝色 text-primary 链） */
export function accountInlineLinkClass(size: AccountButtonSize = "sm") {
  return cn(
    accountPrimaryButtonClass(size),
    "inline-flex shrink-0 items-center no-underline hover:no-underline",
  );
}

/** 个人中心侧栏 / 页内导航链接（非 Button） */
export function accountNavLinkClass(active: boolean) {
  return cn(
    "block rounded-lg px-3 py-2 text-sm transition-colors",
    active
      ? "bg-muted font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );
}

/** 侧栏内「打开子应用」等操作行 */
export function accountNavActionClass(disabled?: boolean) {
  return cn(
    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
    disabled
      ? "cursor-not-allowed text-muted-foreground/60"
      : "text-foreground hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400",
  );
}
