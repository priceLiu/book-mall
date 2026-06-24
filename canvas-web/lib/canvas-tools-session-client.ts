/** 浏览器侧静默续签 tools_token（P0 / P2） */

let refreshInflight: Promise<boolean> | null = null;

export async function refreshCanvasToolsSessionClient(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;

  refreshInflight = (async () => {
    try {
      const r = await fetch("/api/tools-session/refresh", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!r.ok) return false;
      const data = (await r.json().catch(() => null)) as {
        active?: boolean;
      } | null;
      if (data?.active) {
        window.dispatchEvent(new CustomEvent("canvas:tools-session-refreshed"));
        return true;
      }
      window.dispatchEvent(new CustomEvent("canvas:tools-session-expired"));
      return false;
    } catch {
      window.dispatchEvent(new CustomEvent("canvas:tools-session-expired"));
      return false;
    } finally {
      refreshInflight = null;
    }
  })();

  return refreshInflight;
}

export function isCanvasToolsSessionUnauthorized(
  raw: string,
  status?: number,
): boolean {
  if (status === 401) return true;
  const t = raw.trim();
  return (
    t.includes("UNAUTHORIZED") ||
    t.includes("401") ||
    t.includes("缺少 Bearer Token") ||
    t.includes("工具站登录令牌") ||
    t.includes("无效或过期的工具令牌")
  );
}
