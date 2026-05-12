import { ToolShellClient } from "@/components/tool-shell-client";
import { TOOL_NAV_ENTRIES } from "@/config/nav-tools";
import { applyToolNavVisibility } from "@/lib/apply-tool-nav-visibility";
import { fetchToolNavVisibilityMap } from "@/lib/fetch-tool-nav-visibility";
import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * 异步：请求主站 `/api/tools/nav-visibility` 过滤侧栏（失败则展示全部菜单）。
 * 勿在此处 await 主站 introspect；会话仍以客户端 `/api/tools-session` 为准。
 */
export async function ToolShell({ children }: { children: React.ReactNode }) {
  const mainOrigin = getMainSiteOrigin();
  const visibilityMap = await fetchToolNavVisibilityMap(mainOrigin);
  const navEntries = applyToolNavVisibility(TOOL_NAV_ENTRIES, visibilityMap);

  return (
    <ToolShellClient mainOrigin={mainOrigin} navEntries={navEntries}>
      {children}
    </ToolShellClient>
  );
}
