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
        <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-col leading-tight hidden sm:flex">
        <span className="truncate text-sm font-medium text-foreground">{primary}</span>
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
  return (
    <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" className="h-9 px-2 text-sm font-normal" asChild>
          <Link href="/admin">概览</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-sm font-normal">
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
              <Link href="/admin/refunds">退款审核</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-sm font-normal">
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

        <Button variant="ghost" size="sm" className="h-9 px-2 text-sm font-normal" asChild>
          <Link href="/admin/users">用户</Link>
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

        <Button variant="ghost" size="sm" className="h-9 px-2 text-sm font-normal" asChild>
          <Link href="/">回前台</Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-sm font-normal"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          退出
        </Button>
      </div>
    </nav>
  );
}
