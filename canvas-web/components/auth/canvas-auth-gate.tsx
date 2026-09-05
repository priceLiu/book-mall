"use client";

import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { isPublicCanvasPath } from "@/lib/canvas-public-paths";

/** 根 layout 统一鉴权，避免 /projects → /canvas/:id 重复 introspect / 误触发 re-enter。 */
export function CanvasAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (isPublicCanvasPath(pathname)) {
    return <>{children}</>;
  }
  return <RequireAuth>{children}</RequireAuth>;
}
