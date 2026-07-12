import { Suspense } from "react";
import { PortalSigninClient } from "./portal-signin-client";

export const metadata = {
  title: "登录跳转中 — AI Mall",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * 门户登录桥接页：门户品牌登录/注册成功后整页跳到此处，
 * 复用现有 NextAuth `autologin` 通道在 Book 建立会话（共享身份），
 * 再跳 `/api/sso/tools/re-enter` 走既有换票，落子应用 tools_token。
 */
export default function PortalSigninPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">
          登录跳转中…
        </p>
      }
    >
      <PortalSigninClient />
    </Suspense>
  );
}
