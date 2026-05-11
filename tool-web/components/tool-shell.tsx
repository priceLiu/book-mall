import { getMainSiteOrigin } from "@/lib/site-origin";
import { ToolShellClient } from "@/components/tool-shell-client";

/** 同步壳：勿在此处 await 主站 introspect。会话以客户端 `/api/tools-session` 为准（避免 RSC 读 Cookie 与浏览器不一致导致不调会话接口）。 */
export function ToolShell({ children }: { children: React.ReactNode }) {
  const mainOrigin = getMainSiteOrigin();
  return <ToolShellClient mainOrigin={mainOrigin}>{children}</ToolShellClient>;
}
