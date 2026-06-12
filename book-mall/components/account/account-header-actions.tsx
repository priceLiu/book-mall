"use client";

import { ToggleTheme } from "@/components/layout/toogle-theme";
import { accountNavActionClass } from "@/components/account/account-nav-styles";
import { navigateBookMallFullSignOut } from "@/lib/session-kicked-marker";

export function AccountHeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        className={accountNavActionClass(false)}
        onClick={() => navigateBookMallFullSignOut("/")}
      >
        退出登录
      </button>
      <ToggleTheme iconOnly className="shrink-0" />
    </div>
  );
}
