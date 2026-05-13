"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import { LaunchToolsAppButton } from "@/components/account/launch-tools-app";

export function AccountHeaderActions({
  isAdmin,
  showCoursesCta,
  showToolsCta,
  canLaunchTools,
}: {
  isAdmin: boolean;
  showCoursesCta: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
}) {
  return (
    <div className="flex min-h-9 shrink-0 flex-wrap items-center justify-end gap-2">
      {isAdmin ? (
        <Button asChild variant="ghost" size="sm" className="hidden h-9 px-3 sm:inline-flex">
          <Link href="/admin">管理后台</Link>
        </Button>
      ) : null}
      {showCoursesCta ? (
        <Button asChild variant="subscription" size="sm" className="h-9 shrink-0 px-3">
          <Link href="/courses">AI 课程</Link>
        </Button>
      ) : null}
      {showToolsCta ? (
        <LaunchToolsAppButton
          layout="inlineNav"
          variant="subscription"
          enabled={canLaunchTools}
          label="AI 工具"
          openInNewTab
        />
      ) : null}
      <Button asChild variant="subscription" size="sm" className="h-9 shrink-0 px-3">
        <Link href="/account/subscription">订阅中心</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 px-3">
        <Link href="/">返回首页</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 px-3">
        <Link href="/account">个人中心</Link>
      </Button>
      <Button variant="outline" size="sm" className="h-9 shrink-0 px-3" onClick={() => signOut({ callbackUrl: "/" })}>
        退出
      </Button>
      <ToggleTheme iconOnly className="shrink-0" />
    </div>
  );
}
