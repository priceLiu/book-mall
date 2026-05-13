/**
 * 工具站分组 navKey 权威列表（与 book-mall/lib/tool-suite-nav-keys.ts 保持一致）。
 */
export const TOOL_SUITE_NAV_KEYS = [
  "fitting-room",
  "text-to-image",
  "smart-support",
  "app-history",
] as const;

export type ToolSuiteNavKey = (typeof TOOL_SUITE_NAV_KEYS)[number];

export function isToolSuiteNavKey(k: string): k is ToolSuiteNavKey {
  return (TOOL_SUITE_NAV_KEYS as readonly string[]).includes(k);
}
