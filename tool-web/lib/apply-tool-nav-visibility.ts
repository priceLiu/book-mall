import type { ToolNavEntry, ToolNavItem } from "@/config/nav-tools";
import { isToolNavGroup } from "@/config/nav-tools";

function navKeyFromHref(href: string): string {
  const seg = href.replace(/^\//, "").split("/").filter(Boolean)[0];
  return seg ?? href;
}

/** 未出现在 map 中的 navKey 视为展示（主站不可达时 fail-open）。 */
export function applyToolNavVisibility(
  entries: ToolNavEntry[],
  visibleByNavKey: ReadonlyMap<string, boolean>,
): ToolNavEntry[] {
  const visible = (key: string) => visibleByNavKey.get(key) !== false;

  return entries
    .map((entry) => {
      if (isToolNavGroup(entry)) {
        return visible(entry.navKey) ? entry : null;
      }
      const key = entry.navKey ?? navKeyFromHref(entry.href);
      return visible(key) ? entry : null;
    })
    .filter((e): e is ToolNavEntry => e != null);
}

export function flattenToolNavEntries(entries: ToolNavEntry[]): ToolNavItem[] {
  return entries.flatMap((e) => (isToolNavGroup(e) ? e.children : [e]));
}
