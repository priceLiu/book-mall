import type { DashboardNavItem } from "@/components/dashboard-shell";

export const GATEWAY_BASE_NAV: DashboardNavItem[] = [
  { href: "/dashboard/guide", label: "操作指引" },
  { href: "/dashboard", label: "用量" },
  { href: "/dashboard/logs", label: "日志" },
  { href: "/dashboard/status", label: "状态", badgeKey: "backgroundWait" },
  { href: "/dashboard/poll-pool", label: "轮询池", badgeKey: "backgroundWait" },
  { href: "/dashboard/market", label: "模型市场" },
];

export const GATEWAY_FULL_NAV: DashboardNavItem[] = [
  ...GATEWAY_BASE_NAV,
  { href: "/dashboard/models", label: "模型管理" },
  { href: "/dashboard/keys", label: "API密钥" },
  { href: "/dashboard/playground", label: "API调试" },
  { href: "/dashboard/docs", label: "接入文档" },
];

export type GatewayDashboardUser = {
  email: string;
  phone?: string | null;
  name: string | null;
  bookRole?: "ADMIN" | "USER";
  billingPersona?: "PLATFORM_CREDIT" | "BYOK" | null;
  platformPoolDelegate?: { canonicalOwnerEmail: string } | null;
};

export function resolveGatewayDashboardNav(
  user: GatewayDashboardUser,
): DashboardNavItem[] {
  const isByok = user.billingPersona === "BYOK";
  const isPlatformPoolDelegate = Boolean(user.platformPoolDelegate);
  return isByok || isPlatformPoolDelegate
    ? GATEWAY_FULL_NAV
    : GATEWAY_BASE_NAV;
}
