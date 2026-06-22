"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu as MenuIcon } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminToolsStationEntry } from "@/components/admin/admin-tools-station-entry";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import {
  ADMIN_TOP_LEVEL_LINKS,
  adminNavGroupsForDesktop,
  buildAdminNavGroups,
  type AdminNavGroup,
  type AdminNavLink,
} from "@/lib/admin/admin-nav-config";
import { cn } from "@/lib/utils";
import { navigateBookMallFullSignOut } from "@/lib/session-kicked-marker";

const ADMIN_NAV_GHOST =
  "h-9 px-2 text-sm font-normal text-card-foreground hover:bg-accent hover:text-accent-foreground";

const SHEET_ITEM =
  "flex w-full min-w-0 items-center rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted";

export type AdminNavUserProps = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

function navigateToFullSignOut() {
  navigateBookMallFullSignOut("/");
}

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
  const initial = primary.length > 0 ? primary.charAt(0).toUpperCase() : "?";

  return (
    <div
      className="flex max-w-[min(14rem,40vw)] shrink items-center gap-2 rounded-md border border-transparent px-1 py-0.5"
      title={`${user.email ?? ""}${user.email ? " · " : ""}${user.id}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {img ? <AvatarImage src={img} alt="" referrerPolicy="no-referrer" /> : null}
        <AvatarFallback className="text-xs font-semibold text-card-foreground">{initial}</AvatarFallback>
      </Avatar>
      <div className="hidden min-w-0 flex-col leading-tight sm:flex">
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

function NavLinkItem({
  item,
  active,
  onNavigate,
  className,
}: {
  item: AdminNavLink;
  active?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const cls = cn(className, active && "bg-muted font-medium");

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        onClick={() => onNavigate?.()}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} onClick={() => onNavigate?.()}>
      {item.label}
    </Link>
  );
}

function AdminNavDropdown({ group }: { group: AdminNavGroup }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`${ADMIN_NAV_GHOST} gap-1`}>
          {group.label}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[min(70vh,28rem)] w-56 overflow-y-auto">
        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {group.items.map((item) => (
          <DropdownMenuItem key={`${group.id}-${item.href}-${item.label}`} asChild>
            {item.external ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </DropdownMenuItem>
        ))}
        {group.id === "finance" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>对外公示</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/pricing" target="_blank" rel="noopener noreferrer">
                对外报价页（积分）
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pricing-disclosure" target="_blank" rel="noopener noreferrer">
                平台价目表（前台）
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminNavSheet({
  groups,
  pathname,
  financeWebOrigin,
}: {
  groups: AdminNavGroup[];
  pathname: string;
  financeWebOrigin: string | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-card-foreground transition-colors hover:bg-accent md:hidden"
          aria-label="打开管理菜单"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[17rem] max-w-[85vw] gap-0 overflow-y-auto p-0">
        <SheetTitle className="sr-only">管理后台菜单</SheetTitle>
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">管理后台</p>
          {!financeWebOrigin ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              未配置财务控制台域名时，部分链接走 Book 内重定向页。
            </p>
          ) : null}
        </div>
        <nav className="space-y-4 px-3 py-4" aria-label="管理后台导航">
          {ADMIN_TOP_LEVEL_LINKS.map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            return (
              <NavLinkItem
                key={link.href}
                item={link}
                active={active}
                onNavigate={() => setOpen(false)}
                className={SHEET_ITEM}
              />
            );
          })}
          {groups.map((group) => (
            <div key={group.id}>
              <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLinkItem
                    key={`${group.id}-${item.href}-${item.label}`}
                    item={item}
                    onNavigate={() => setOpen(false)}
                    className={SHEET_ITEM}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AdminNav({
  user,
  toolsSsoReady,
  toolsSsoIssues,
  financeWebOrigin,
}: {
  user: AdminNavUserProps;
  toolsSsoReady: boolean;
  toolsSsoIssues: string[];
  financeWebOrigin: string | null;
}) {
  const pathname = usePathname();
  const desktopGroups = adminNavGroupsForDesktop(financeWebOrigin);
  const allGroups = buildAdminNavGroups(financeWebOrigin);

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-x-1 gap-y-2 text-card-foreground">
      <AdminNavSheet groups={allGroups} pathname={pathname} financeWebOrigin={financeWebOrigin} />

      <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 md:flex">
        {ADMIN_TOP_LEVEL_LINKS.map((link) => (
          <Button key={link.href} variant="ghost" size="sm" className={ADMIN_NAV_GHOST} asChild>
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
        {desktopGroups.map((group) => (
          <AdminNavDropdown key={group.id} group={group} />
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <AdminHeaderUser user={user} />

        <span className="mx-0.5 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

        <AdminToolsStationEntry toolsSsoReady={toolsSsoReady} toolsSsoIssues={toolsSsoIssues} />

        <span className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

        <ToggleTheme iconOnly />

        <span className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

        <Button variant="ghost" size="sm" className={`${ADMIN_NAV_GHOST} hidden sm:inline-flex`} asChild>
          <Link href="/account">个人中心</Link>
        </Button>

        <Button variant="ghost" size="sm" className={`${ADMIN_NAV_GHOST} hidden sm:inline-flex`} asChild>
          <Link href="/">回前台</Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${ADMIN_NAV_GHOST} hidden sm:inline-flex`}
          onClick={navigateToFullSignOut}
        >
          退出
        </Button>
      </div>
    </nav>
  );
}
