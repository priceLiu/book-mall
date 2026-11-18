"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { NavbarSignOutButton } from "@/components/layout/navbar-sign-out-button";

/**
 * Home V2 顶栏登录态：以客户端 Session 为准，避免 RSC 缓存或未清 Cookie 时误显示「个人中心 / 退出」。
 */
export function HomeV2NavAuthSlot() {
  const { data: session, status } = useSession();
  const loggedIn = status === "authenticated" && Boolean(session?.user);

  if (!loggedIn) {
    return (
      <div className="home-v2-nav-auth">
        <Link href="/login" className="apple-nav-link home-v2-auth-hide-mobile">
          登录
        </Link>
        <Link href="/register" className="apple-nav-link">
          注册
        </Link>
      </div>
    );
  }

  const isAdminUser = session!.user!.role === "ADMIN";

  return (
    <div className="home-v2-nav-auth">
      {isAdminUser ? (
        <Link href="/admin" className="apple-nav-link home-v2-auth-hide-mobile">
          管理后台
        </Link>
      ) : null}
      <Link href="/account" className="apple-nav-link">
        个人中心
      </Link>
      <NavbarSignOutButton appearance="site-home-v2" />
    </div>
  );
}