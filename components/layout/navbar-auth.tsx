"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function NavbarAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-muted-foreground px-2">…</span>;
  }

  if (session?.user) {
    const isAdmin = session.user.role === "ADMIN";
    return (
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">管理后台</Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm">
          <Link href="/account">个人中心</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
          退出
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">登录</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">注册</Link>
      </Button>
    </div>
  );
}
