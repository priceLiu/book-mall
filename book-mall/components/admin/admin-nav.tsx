"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminToolsStationEntry } from "@/components/admin/admin-tools-station-entry";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

/** Ghost 顶栏按钮默认不显式前景色时，在深色/磨砂背景下可能被「吃掉」；与 `bg-card` 顶栏对齐为 card 前景色 */
const ADMIN_NAV_GHOST =
  "h-9 px-2 text-sm font-normal text-card-foreground hover:bg-accent hover:text-accent-foreground";

export type AdminNavUserProps = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

function avatarLooksAbsolute(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function AdminHeaderUser({ user }: { user: AdminNavUserProps }) {
  const img =
    user.image?.trim() && avatarLooksAbsolute(user.image)
      ? user.image.trim()
      : null;
  const hasProfile = Boolean(user.name?.trim() || user.email?.trim());
  const primary =
    user.name?.trim() ||
    user.email?.trim() ||
    (user.id.length > 14 ? `${user.id.slice(0, 12)}…` : user.id);
  let secondary: string | null = null;
  if (user.name?.trim() && user.email?.trim()) {
    secondary = user.email.trim();
  } else if (hasProfile) {
    secondary = `ID ${user.id.length > 22 ? `${user.id.slice(0, 20)}…` : user.id}`;
  }
  const initial =
    primary.length > 0 ? primary.charAt(0).toUpperCase() : "?";

  return (
    <div
      className="flex max-w-[min(14rem,40vw)] shrink items-center gap-2 rounded-md border border-transparent px-1 py-0.5"
      title={`${user.email ?? ""}${user.email ? " · " : ""}${user.id}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {img ? <AvatarImage src={img} alt="" referrerPolicy="no-referrer" /> : null}
        <AvatarFallback className="text-xs font-semibold text-card-foreground">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-col leading-tight hidden sm:flex">
        <span className="truncate text-sm font-medium text-card-foreground">{primary}</span>
        {secondary ? (
          <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </div>
      <span className="hidden shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary sm:inline-flex">
        管理员
      </span>
    </div>
  );
}

export function AdminNav({
  user,
  toolsSsoReady,
  toolsSsoIssues,
}: {
  user: AdminNavUserProps;
  toolsSsoReady: boolean;
  toolsSsoIssues: string[];
}) {
  const financeWebOrigin = getFinanceWebPublicOrigin();

  return (
    <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-2 text-card-foreground">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" className={ADMIN_NAV_GHOST} asChild>
          <Link href="/admin">概览</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={`${ADMIN_NAV_GHOST} gap-1`}>
              计费与资金
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>计费与资金</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/billing">订阅与充值</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/finance/recharges">充值明细</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/finance/promo-templates">充值优惠模板</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/refunds">提现审核</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/finance/usage-overview">费用多维度概览</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/finance/reconciliation">云账单对账</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/finance/pricing-templates">计费模板与公式</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/finance/cloud-pricing">云厂商价目表</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {financeWebOrigin ? (
              <>
                <DropdownMenuItem asChild>
                  <a
                    href={`${financeWebOrigin}/fees/billing/details`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    财务控制台 · 账单详情
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`${financeWebOrigin}/admin`} target="_blank" rel="noopener noreferrer">
                    财务控制台 · 管理端
                  </a>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled className="text-muted-foreground">
                财务控制台（未配置 NEXT_PUBLIC_FINANCE_WEB_ORIGIN）
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={`${ADMIN_NAV_GHOST} gap-1`}>
              产品与内容
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>产品与内容</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/categories">产品分类</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/products">产品管理</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className={ADMIN_NAV_GHOST} asChild>
          <Link href="/admin/users">用户</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={`${ADMIN_NAV_GHOST} gap-1`}>
              工具应用管理
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>工具应用管理</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/tool-apps/tool-menu">工具菜单</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/tool-apps/manage">工具管理</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/tool-libraries">资源库（图/视频）</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/tool-usage">工具使用明细与费用</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/tools-sso-test">工具站跳转测试</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className={ADMIN_NAV_GHOST} asChild>
          <Link href="/admin/security">账号安全</Link>
        </Button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <AdminHeaderUser user={user} />

        <span className="mx-0.5 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

        <AdminToolsStationEntry
          toolsSsoReady={toolsSsoReady}
          toolsSsoIssues={toolsSsoIssues}
        />

        <span className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

        <ToggleTheme iconOnly />

        <span className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

        <Button variant="ghost" size="sm" className={ADMIN_NAV_GHOST} asChild>
          <Link href="/account">个人中心</Link>
        </Button>

        <Button variant="ghost" size="sm" className={ADMIN_NAV_GHOST} asChild>
          <Link href="/">回前台</Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={ADMIN_NAV_GHOST}
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          退出
        </Button>
      </div>
    </nav>
  );
}
