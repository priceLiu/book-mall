"use client";

import { Button } from "@/components/ui/button";
import { navigateBookMallFullSignOut } from "@/lib/session-kicked-marker";
import { cn } from "@/lib/utils";

/**
 * 退出流程：直接跳 /api/auth/full-signout（一次性清掉所有 NextAuth Cookie 变体并 302 回首页）。
 * 不再先走 next-auth/react 的 signOut——它在 CloudBase Run 容器内偶发把回调 URL
 * 解析成内部 0.0.0.0:3000，导致用户被「踢」到无法访问的地址。
 */
export function NavbarSignOutButton({
  className,
  appearance = "default",
}: {
  className?: string;
  appearance?: "default" | "site-home";
}) {
  if (appearance === "site-home") {
    return (
      <button
        type="button"
        className={cn("site-home-nav-action-outline", className)}
        onClick={() => navigateBookMallFullSignOut("/")}
      >
        退出
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-9 shrink-0 px-3", className)}
      onClick={() => navigateBookMallFullSignOut("/")}
    >
      退出
    </Button>
  );
}
