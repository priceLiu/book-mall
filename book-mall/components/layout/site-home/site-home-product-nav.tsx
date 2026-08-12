"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildBookPortalNavItems } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";

const splitBtnClass =
  "rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 h-9 px-4 pointer-events-none";

/** 顶栏「产品」：与各子站 federated 门户菜单一致 */
export function SiteHomeProductNav({ variant = "button" }: { variant?: "button" | "link" }) {
  const [open, setOpen] = useState(false);
  const items = buildBookPortalNavItems();

  const menuLinks = (
    <div className="flex flex-col gap-0.5 p-1">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className="site-home-nav-sheet-item rounded-md px-3 py-2.5 hover:bg-muted"
          onClick={() => setOpen(false)}
        >
          {item.label}
        </a>
      ))}
    </div>
  );

  if (variant === "link") {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn("site-home-nav-link", open && "site-home-nav-link-active")}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span>产品</span>
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-44"
          side="bottom"
          sideOffset={8}
          align="center"
        >
          {menuLinks}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="产品菜单"
          className="inline-flex -space-x-px divide-x divide-primary-foreground/30 rounded-lg shadow-sm shadow-black/5 rtl:space-x-reverse cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <Button variant="default" type="button" className={splitBtnClass} tabIndex={-1}>
            产品
          </Button>
          <Button variant="default" type="button" size="icon" className={`${splitBtnClass} w-9`} tabIndex={-1}>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-44"
        side="bottom"
        sideOffset={4}
        align="end"
      >
        {menuLinks}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
