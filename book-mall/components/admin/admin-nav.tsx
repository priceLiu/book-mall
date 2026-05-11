"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
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

export function AdminNav({
  toolsSsoReady,
  toolsSsoIssues,
}: {
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

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <span className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden />

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
