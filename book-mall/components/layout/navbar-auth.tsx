import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NavbarSignOutButton } from "./navbar-sign-out-button";

export async function NavbarAuth({ appearance = "default" }: { appearance?: "default" | "site-home" }) {
  const session = await getServerSession(authOptions);

  if (appearance === "site-home") {
    if (!session?.user) {
      return (
        <div className="site-home-nav-auth">
          <Link href="/login" className="site-home-nav-action-outline">登录</Link>
          <Link href="/register" className="site-home-nav-action-primary">注册</Link>
        </div>
      );
    }

    const isAdminUser = session.user.role === "ADMIN";

    return (
      <div className="site-home-nav-auth">
        {isAdminUser ? (
          <Link href="/admin" className="site-home-nav-action-link">管理后台</Link>
        ) : null}
        <Link href="/account" className="site-home-nav-action-primary">个人中心</Link>
        <NavbarSignOutButton appearance="site-home" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex h-9 flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm" className="h-9 px-3">
          <Link href="/login">登录</Link>
        </Button>
        <Button asChild size="sm" className="h-9 px-3">
          <Link href="/register">注册</Link>
        </Button>
      </div>
    );
  }

  const isAdminUser = session.user.role === "ADMIN";

  return (
    <div className="flex h-9 flex-wrap items-center justify-end gap-2">
      {isAdminUser ? (
        <Button asChild variant="ghost" size="sm" className="hidden h-9 shrink-0 px-3 sm:inline-flex">
          <Link href="/admin">管理后台</Link>
        </Button>
      ) : null}
      <Button asChild size="sm" className="shrink-0">
        <Link href="/account">个人中心</Link>
      </Button>
      <NavbarSignOutButton />
    </div>
  );
}
