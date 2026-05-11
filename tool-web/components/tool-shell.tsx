import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { ToolShellClient } from "@/components/tool-shell-client";

/** 同步壳：勿在此处 await 主站 introspect，否则整棵 RSC 长时间卡在 Suspense/骨架屏 */
export function ToolShell({ children }: { children: React.ReactNode }) {
  const jar = cookies();
  const rawToken = jar.get("tools_token")?.value;
  const hasTokenCookie =
    typeof rawToken === "string" && rawToken.trim().length > 0;
  const mainOrigin = getMainSiteOrigin();

  return (
    <ToolShellClient mainOrigin={mainOrigin} hasTokenCookie={hasTokenCookie}>
      {children}
    </ToolShellClient>
  );
}
