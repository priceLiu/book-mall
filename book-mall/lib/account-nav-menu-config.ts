import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  GraduationCap,
  Home,
  Key,
  LayoutGrid,
  LogOut,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  User,
  Wallet,
  Wrench,
} from "lucide-react";

export type AccountNavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  external?: boolean;
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
  billing: "充值与费用",
  admin: "管理员",
  apps: "应用",
  classroom: "课堂",
  disclosure: "公示",
  account: "帐户",
} as const;

/** 个人中心 Ark Menu 分组（顺序即展示顺序） */
export function buildAccountNavMenuGroups(input: {
  isAdmin: boolean;
  showToolsLaunch: boolean;
  showCanvasLaunch: boolean;
  showEcomLaunch: boolean;
}): AccountNavMenuGroup[] {
  const groups: AccountNavMenuGroup[] = [
    {
      id: "billing",
      label: GROUP_LABELS.billing,
      items: [
        { kind: "link", href: "/account/recharge-promos", label: "充值优惠", icon: Sparkles },
        { kind: "link", href: "/account/billing", label: "费用与明细", icon: Receipt, exact: true },
        { kind: "link", href: "/account/tool-service-fee", label: "工具技术服务费", icon: CreditCard },
        { kind: "link", href: "/account/subscription", label: "订阅中心", icon: Wallet },
      ],
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
    appItems.push({
      kind: "link",
      href: "/account/ecommerce",
      label: "电商工具箱设置",
      icon: LayoutGrid,
    });
  }
  if (appItems.length > 0) {
    groups.push({ id: "apps", label: GROUP_LABELS.apps, items: appItems });
  }

  groups.push(
    {
      id: "classroom",
      label: GROUP_LABELS.classroom,
      items: [
        { kind: "link", href: "/account/courses", label: "AI 学堂", icon: GraduationCap },
      ],
    },
    {
      id: "disclosure",
      label: GROUP_LABELS.disclosure,
      items: [
        { kind: "link", href: "/account/pricing", label: "价目与公示", icon: Receipt },
      ],
    },
    {
      id: "account",
      label: GROUP_LABELS.account,
      items: [
        { kind: "link", href: "/account", label: "概览", icon: User, exact: true },
        { kind: "link", href: "/account/security", label: "账户与安全", icon: Shield, exact: true },
        { kind: "link", href: "/account/gateway", label: "Gateway API Key", icon: Key },
        { kind: "link", href: "/", label: "返回商城首页", icon: Home },
        { kind: "action", id: "sign-out", label: "退出登录", icon: LogOut, accent: "subscription" },
      ],
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
