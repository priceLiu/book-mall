/** 拉取主站公开接口：工具站左侧菜单可见性（无需登录）。 */

export async function fetchToolNavVisibilityMap(
  mainOrigin: string | null,
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const origin = mainOrigin?.trim();
  if (!origin) return map;

  const url = `${origin.replace(/\/$/, "")}/api/tools/nav-visibility`;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4000);
    const res = await fetch(url, { cache: "no-store", signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) return map;

    const raw = (await res.json()) as {
      entries?: { navKey?: string; visible?: boolean }[];
    };
    if (!Array.isArray(raw.entries)) return map;

    for (const row of raw.entries) {
      const k = row.navKey?.trim();
      if (!k) continue;
      map.set(k, Boolean(row.visible));
    }
  } catch {
    /* 主站不可达：返回空 map，侧栏按「全部展示」处理 */
  }

  return map;
}
