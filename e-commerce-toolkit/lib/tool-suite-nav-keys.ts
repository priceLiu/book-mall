export const ECOM_NAV_KEY = "e-commerce-toolkit" as const;

export const TOOL_SUITE_NAV_KEYS = [ECOM_NAV_KEY] as const;

export type ToolSuiteNavKey = (typeof TOOL_SUITE_NAV_KEYS)[number];
