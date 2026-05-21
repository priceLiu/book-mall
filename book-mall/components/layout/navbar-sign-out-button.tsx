"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * 退出流程：
 *   1) NextAuth 自带 signOut 走标准 CSRF + 清当前生效的 Cookie（不跳转）；
 *   2) 跳到自建 /api/auth/full-signout，再次清扫所有变体（包括升级前残留的 host-only）；
 *   3) full-signout 302 回首页。
 */
async function fullSignOut() {
  try {
    await signOut({ redirect: false });
  } catch {
    /* 即便 NextAuth 失败也继续走兜底清理 */
  }
  window.location.href = "/api/auth/full-signout?callbackUrl=/";
}

export function NavbarSignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 shrink-0 px-3"
      onClick={() => void fullSignOut()}
    >
      退出
    </Button>
  );
}
