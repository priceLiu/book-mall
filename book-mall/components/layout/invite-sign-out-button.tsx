"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { navigateBookMallFullSignOut } from "@/lib/session-kicked-marker";

/** 邀请页专用：退出后回到当前邀请链接（不含站点个人中心/管理后台入口）。 */
export function InviteSignOutButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const returnUrl = qs ? `${pathname}?${qs}` : pathname;

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 shrink-0 px-3"
      onClick={() => navigateBookMallFullSignOut(returnUrl)}
    >
      退出登录
    </Button>
  );
}
