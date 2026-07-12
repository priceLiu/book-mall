"use client";

import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";

const PUBLIC_PREFIXES = ["/auth/", "/sso-error", "/login", "/register"];
// 门户独立入口：落地页 `/`、画作展示 `/gallery` 供 SEO / 直接注册登录，无需 token。
const PUBLIC_EXACT = new Set(["/", "/gallery"]);

function isPublicCanvasPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** 根 layout 统一鉴权，避免 /projects → /canvas/:id 重复 introspect / 误触发 re-enter。 */
export function CanvasAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (isPublicCanvasPath(pathname)) {
    return <>{children}</>;
  }
  return <RequireAuth>{children}</RequireAuth>;
}
