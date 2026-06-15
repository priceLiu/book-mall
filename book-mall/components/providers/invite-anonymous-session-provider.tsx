"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * 邀请落地页：不向客户端 SessionProvider 注入旧会话，避免顶栏/表单误读其他账号 Cookie。
 * 子树内 signIn 成功后仍会正常更新会话。
 */
export function InviteAnonymousSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider session={null} refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
