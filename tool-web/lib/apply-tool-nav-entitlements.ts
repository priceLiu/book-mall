import type { ToolNavEntry } from "@/config/nav-tools";
import { isToolNavGroup } from "@/config/nav-tools";

/** 按主站下发的 tools_nav_keys 过滤侧栏（管理员调用方可传入全集以跳过语义）。 */
export function applyToolNavEntitlements(
  entries: ToolNavEntry[],
  opts: { toolsRole: string | null; toolsNavKeys: readonly string[] | null },
): ToolNavEntry[] {
  if (opts.toolsRole === "admin") return entries;

  const allowed = new Set(opts.toolsNavKeys ?? []);
  if (allowed.size === 0) return [];

  return entries
    .map((entry) => {
      if (isToolNavGroup(entry)) {
        return allowed.has(entry.navKey) ? entry : null;
      }
      const key =
        entry.navKey ??
        entry.href.replace(/^\//, "").split("/").filter(Boolean)[0] ??
        "";
      return allowed.has(key) ? entry : null;
    })
    .filter((e): e is ToolNavEntry => e != null);
}
