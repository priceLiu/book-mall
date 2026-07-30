let refreshInflight: Promise<boolean> | null = null;

export async function refreshToolsSessionClient(): Promise<boolean> {
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
        window.dispatchEvent(new CustomEvent("common-tools:session-refreshed"));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();

  return refreshInflight;
}
