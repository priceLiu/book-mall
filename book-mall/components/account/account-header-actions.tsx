"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ToggleTheme } from "@/components/layout/toogle-theme";

export function AccountHeaderActions({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
      <ToggleTheme iconOnly />
      {isAdmin ? (
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/admin">管理后台</Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm">
        <Link href="/">返回首页</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
        退出
      </Button>
    </div>
  );
}
