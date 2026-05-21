"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const SITE_HOME_PRODUCT_OPTIONS = [
  {
    value: "ai-apps",
    label: "AI 应用",
    description: "工具型产品与在线应用",
    href: "/products/ai-apps",
  },
  {
    value: "ai-courses",
    label: "AI 课程（导购）",
    description: "商品化的课程产品介绍",
    href: "/products/ai-courses",
  },
  {
    value: "courses",
    label: "AI 学堂",
    description: "课程学习与订阅权益",
    href: "/courses",
  },
] as const;

function resolveProductValue(pathname: string) {
  if (pathname.startsWith("/products/ai-courses")) return "ai-courses";
  if (pathname === "/courses" || pathname.startsWith("/courses/")) return "courses";
  return "ai-apps";
}

const splitBtnClass =
  "rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 h-9 px-4 pointer-events-none";

/** 顶栏「产品」：分割按钮点击均打开下拉；仅菜单项跳转 */
export function SiteHomeProductNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = resolveProductValue(pathname);
  const active =
    SITE_HOME_PRODUCT_OPTIONS.find((o) => o.value === selected) ?? SITE_HOME_PRODUCT_OPTIONS[0];
  const onProductSection =
    pathname.startsWith("/products/") ||
    pathname === "/courses" ||
    pathname.startsWith("/courses/");

  const mainLabel = onProductSection ? active.label : "产品";

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
            {mainLabel}
          </Button>
          <Button variant="default" type="button" size="icon" className={`${splitBtnClass} w-9`} tabIndex={-1}>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="max-w-64 md:max-w-xs"
        side="bottom"
        sideOffset={4}
        align="end"
      >
        <DropdownMenuRadioGroup
          value={selected}
          onValueChange={(value) => {
            const option = SITE_HOME_PRODUCT_OPTIONS.find((o) => o.value === value);
            if (!option) return;
            setOpen(false);
            router.push(option.href);
          }}
        >
          {SITE_HOME_PRODUCT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="items-start [&>span]:pt-1.5"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
