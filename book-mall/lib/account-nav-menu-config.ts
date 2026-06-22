import type { LucideIcon } from "lucide-react";
import type { BillingPersona } from "@prisma/client";
import {
  Copy,
  CreditCard,
  GraduationCap,
  Home,
  Key,
  LayoutGrid,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  User,
  Wallet,
  Wrench,
  BarChart3,
  Receipt,
  ScrollText,
  Activity,
} from "lucide-react";

export type AccountNavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** 外链（finance-web 等），新标签打开 */
  external?: boolean;
  /** 站内跳转也新标签打开（如经 /account/usage 再 302 到 finance-web） */
  openInNewTab?: boolean;
};

export type AccountNavActionItem = {
  kind: "action";
  id: string;
  label: string;
  icon: LucideIcon;
  /** 站内统一橙色主按钮（如退出登录） */
  accent?: "subscription";
};

export type AccountNavMenuItem = AccountNavLinkItem | AccountNavActionItem;

export type AccountNavMenuGroup = {
  id: string;
  label: string;
  items: AccountNavMenuItem[];
};

const GROUP_LABELS = {
  billing: "积分与费用",
  admin: "管理员",
  apps: "应用",
  classroom: "课堂",
  account: "帐户",
} as const;

import { getFinanceFeesRedirectUrl } from "@/lib/finance-account-redirect";
import { GATEWAY_LOGS_SSO_HREF } from "@/lib/gateway/gateway-console-sso";

function financeNavItem(
  path: string,
  fallbackHref: string,
  label: string,
  icon: LucideIcon,
): AccountNavLinkItem {
  const direct = getFinanceFeesRedirectUrl(path);
  if (direct) {
    return { kind: "link", href: direct, label, icon, external: true };
  }
  return { kind: "link", href: fallbackHref, label, icon, openInNewTab: true };
}

/** 个人中心 Ark Menu 分组（顺序即展示顺序） */
export function buildAccountNavMenuGroups(input: {
  isAdmin: boolean;
  billingPersona: BillingPersona | null;
  showToolsLaunch: boolean;
  showCanvasLaunch: boolean;
  showEcomLaunch: boolean;
  showQuickReplicaLaunch: boolean;
}): AccountNavMenuGroup[] {
  const isByok = input.billingPersona === "BYOK";
  const isPlatform = input.billingPersona === "PLATFORM_CREDIT" || !input.billingPersona;

  const billingItems: AccountNavMenuItem[] = [
    { kind: "link", href: "/account/billing", label: "轻量包购买", icon: Sparkles, exact: true },
    financeNavItem("/fees/usage", "/account/usage", "积分用量", BarChart3),
    financeNavItem("/fees/billing/details", "/account/fees/details", "费用明细", Receipt),
    financeNavItem("/fees/billing/ledger", "/account/fees/ledger", "积分流水", ScrollText),
  ];
  if (isByok) {
    billingItems.push(
      financeNavItem("/fees/billing/byok", "/account/fees/byok", "BYOK 任务用量", Key),
    );
    billingItems.push({ kind: "link", href: "/account/byok", label: "自带 Key 管理", icon: Key });
  }
  if (isPlatform) {
    billingItems.push({ kind: "link", href: "/pricing", label: "会员套餐", icon: CreditCard });
  }
  billingItems.push({
    kind: "link",
    href: "/account/subscription",
    label: "学堂订阅",
    icon: Wallet,
  });

  const groups: AccountNavMenuGroup[] = [
    {
      id: "billing",
      label: GROUP_LABELS.billing,
      items: billingItems,
    },
  ];

  if (input.isAdmin) {
    groups.push({
      id: "admin",
      label: GROUP_LABELS.admin,
      items: [
        {
          kind: "link",
          href: "/admin",
          label: "管理后台",
          icon: Settings,
          external: true,
        },
        {
          kind: "link",
          href: GATEWAY_LOGS_SSO_HREF,
          label: "Gateway 日志",
          icon: Activity,
          openInNewTab: true,
        },
      ],
    });
  }

  const appItems: AccountNavMenuItem[] = [];
  if (input.showToolsLaunch) {
    appItems.push({ kind: "action", id: "launch-tools", label: "AI 工具站", icon: Wrench });
  }
  if (input.showCanvasLaunch) {
    appItems.push({ kind: "action", id: "launch-canvas", label: "AI 画布", icon: LayoutGrid });
  }
  if (input.showEcomLaunch) {
    appItems.push({ kind: "action", id: "launch-ecom", label: "打开电商工具箱", icon: LayoutGrid });
  }
  if (input.showQuickReplicaLaunch) {
    appItems.push({ kind: "action", id: "launch-quick-replica", label: "快速复制", icon: Copy });
  }
  if (appItems.length > 0) {
    groups.push({ id: "apps", label: GROUP_LABELS.apps, items: appItems });
  }

  const accountItems: AccountNavMenuItem[] = [
    { kind: "link", href: "/account", label: "概览", icon: User, exact: true },
    { kind: "link", href: "/account/security", label: "账户与安全", icon: Shield, exact: true },
  ];

  if (isByok) {
    accountItems.push({
      kind: "link",
      href: "/account/gateway",
      label: "Gateway API Key",
      icon: Key,
    });
  }

  accountItems.push(
    { kind: "link", href: "/", label: "返回商城首页", icon: Home },
    { kind: "action", id: "sign-out", label: "退出登录", icon: LogOut, accent: "subscription" },
  );

  groups.push(
    {
      id: "classroom",
      label: GROUP_LABELS.classroom,
      items: [
        { kind: "link", href: "/account/courses", label: "AI 学堂", icon: GraduationCap },
      ],
    },
    {
      id: "account",
      label: GROUP_LABELS.account,
      items: accountItems,
    },
  );

  return groups;
}

export function isAccountNavLinkActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
