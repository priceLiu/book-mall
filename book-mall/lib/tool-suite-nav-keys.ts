/**
 * 工具站分组 navKey 权威列表（与 tool-web/config/nav-tools 各组 navKey 一致）。
 * 变更时请同步 tool-web/lib/tool-suite-nav-keys.ts。
 */
export const TOOL_SUITE_NAV_KEYS = [
  "fitting-room",
  "text-to-image",
  "smart-support",
  "app-history",
] as const;

export type ToolSuiteNavKey = (typeof TOOL_SUITE_NAV_KEYS)[number];
