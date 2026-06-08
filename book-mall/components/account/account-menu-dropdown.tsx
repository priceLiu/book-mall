"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CreditCard,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/radix-dropdown-menu";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import {
  openCanvasAppInNewTab,
  openEcomAppInNewTab,
  openToolsAppInNewTab,
} from "@/lib/account-app-launch";

const NAV_LINKS = [
  { href: "/account", label: "概览", icon: User, exact: true },
  { href: "/account/subscription", label: "订阅中心", icon: CreditCard },
  { href: "/account/usage", label: "积分用量中心", icon: Zap },
  { href: "/account/team", label: "团队空间", icon: Users },
  { href: "/account/team/billing", label: "团队账单", icon: Receipt },
  { href: "/account/tool-service-fee", label: "工具技术服务费", icon: Receipt },
  { href: "/account/recharge-promos", label: "充值优惠", icon: Sparkles },
  { href: "/account/courses", label: "AI 学堂", icon: Sparkles },
  { href: "/account/pricing", label: "价目与公示", icon: Settings },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountMenuDropdown({
  profileLabel,
  isAdmin,
  showToolsCta,
  canLaunchTools,
  canLaunchCanvas,
  canvasOriginConfigured,
  gatewayLinked,
  canLaunchEcommerce,
  ecomOriginConfigured,
}: {
  profileLabel: string;
  isAdmin: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  gatewayLinked: boolean;
  canLaunchEcommerce: boolean;
  ecomOriginConfigured: boolean;
}) {
  const pathname = usePathname();
  const canvasReady =
    gatewayLinked && canLaunchCanvas && canvasOriginConfigured;
  const ecomReady = canLaunchEcommerce && ecomOriginConfigured;

  function signOut() {
    window.location.href = "/api/auth/full-signout?callbackUrl=/";
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted/60 active:scale-[0.98]"
            aria-label="打开个人中心菜单"
          >
            <Menu className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="hidden sm:inline">账户菜单</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold leading-none">{profileLabel}</p>
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              个人中心
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {NAV_LINKS.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  className={
                    isActive(
                      pathname,
                      item.href,
                      "exact" in item ? item.exact : false,
                    )
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link
                  href="/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground"
                >
                  <Settings />
                  <span>管理后台</span>
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Zap />
                <span>打开应用</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {showToolsCta ? (
                    <DropdownMenuItem
                      disabled={!canLaunchTools}
                      onSelect={(e) => {
                        e.preventDefault();
                        void openToolsAppInNewTab("/fitting-room");
                      }}
                    >
                      <Zap />
                      <span>AI 工具站</span>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    disabled={!canvasReady}
                    onSelect={(e) => {
                      e.preventDefault();
                      openCanvasAppInNewTab("/projects");
                    }}
                  >
                    <LayoutGrid />
                    <span>AI 画布</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!ecomReady}
                    onSelect={(e) => {
                      e.preventDefault();
                      openEcomAppInNewTab("/");
                    }}
                  >
                    <ShoppingBag />
                    <span>电商工具箱</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/" className="text-muted-foreground">
              <Home />
              <span>返回商城首页</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              signOut();
            }}
          >
            <LogOut />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToggleTheme iconOnly className="shrink-0" />
    </div>
  );
}
