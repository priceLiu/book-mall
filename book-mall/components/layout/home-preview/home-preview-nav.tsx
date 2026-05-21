"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Github,
  Languages,
  Menu,
  Paintbrush,
  Search,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = {
  label: string;
  href: string;
  badge?: string;
  external?: boolean;
};

const sideNavLinks: NavItem[] = [
  { label: "组件", href: "/products/ai-apps" },
  { label: "主题", href: "/home-preview" },
  { label: "设计转代码", href: "/home-preview#hero-video" },
  { label: "模板", href: "/home-preview#more-ai-apps" },
  { label: "数据可视化", href: "#pricing", badge: "NEW" },
  { label: "博客", href: "/home-preview" },
];

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M19.63 8c.02.17.02.35.02.52 0 5.33-4.06 11.46-11.46 11.46-2.29 0-4.4-.66-6.19-1.8a8.07 8.07 0 0 0 5.97-1.67 4.04 4.04 0 0 1-3.76-2.8 4.29 4.29 0 0 0 1.82-.08A4.03 4.03 0 0 1 2.8 9.68v-.05c.54.3 1.16.49 1.82.51a4.02 4.02 0 0 1-1.25-5.38 11.46 11.46 0 0 0 8.3 4.21 4.03 4.03 0 0 1 6.87-3.68 7.96 7.96 0 0 0 2.56-.97c-.3.93-.93 1.72-1.77 2.22.81-.09 1.6-.31 2.32-.63-.55.8-1.23 1.51-2.02 2.09Z" />
    </svg>
  );
}

export function HomePreviewNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navigate = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) {
      if (pathname === "/home-preview") {
        document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
      } else {
        router.push(`/home-preview${href}`);
      }
      return;
    }
    if (href.includes("#")) {
      const [path, hash] = href.split("#");
      router.push(`${path}${hash ? `#${hash}` : ""}`);
      return;
    }
    router.push(href);
  };

  return (
    <header className="home-preview-nav sticky top-0 z-[999] w-full border-b">
      <div className="home-preview-nav-container">
        <Link
          href="/home-preview"
          className="home-preview-nav-logo shrink-0"
          aria-label="智选 AI 首页"
        >
          <Image
            src="/logo2.png"
            alt="智选 AI"
            width={144}
            height={144}
            className="h-9 w-auto object-contain dark:mix-blend-screen"
            priority
          />
        </Link>

        <nav className="home-preview-side-nav hidden lg:flex" aria-label="主导航">
          {sideNavLinks.map((item, index) => (
            <div
              key={item.label}
              className={cn("home-preview-side-nav-item", index === 0 && "home-preview-side-nav-item-first")}
            >
              {item.href.startsWith("#") || item.href.includes("#") ? (
                <button type="button" onClick={() => navigate(item.href)} className="home-preview-nav-link">
                  <span>{item.label}</span>
                  {item.badge ? <span className="home-preview-nav-badge">{item.badge}</span> : null}
                </button>
              ) : (
                <Link href={item.href} className="home-preview-nav-link">
                  <span>{item.label}</span>
                  {item.badge ? <span className="home-preview-nav-badge">{item.badge}</span> : null}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="home-preview-nav-opts ml-auto flex items-center">
          <button
            type="button"
            className="home-preview-nav-icon-btn home-preview-nav-dsm hidden sm:inline-flex"
            aria-label="主题定制"
          >
            <Paintbrush className="size-[18px]" />
          </button>

          <ToggleTheme
            iconOnly
            className="home-preview-nav-icon-btn hidden h-9 w-9 text-[hsl(215,16%,65%)] hover:bg-transparent hover:text-foreground sm:inline-flex [&_svg]:size-5"
          />

          <button type="button" className="home-preview-nav-icon-btn hidden md:inline-flex" aria-label="Twitter">
            <TwitterIcon className="size-5" />
          </button>

          <button type="button" className="home-preview-nav-icon-btn hidden md:inline-flex" aria-label="GitHub">
            <Github className="size-5" />
          </button>

          <button
            type="button"
            className="home-preview-nav-lang hidden md:inline-flex"
            aria-label="Switch to English"
          >
            <Languages className="size-[22px] shrink-0" />
            <span>EN</span>
          </button>

          <div className="home-preview-nav-search hidden lg:flex" role="search">
            <Search className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="home-preview-nav-search-text">搜索</span>
            <kbd className="home-preview-nav-search-kbd">⌘ K</kbd>
          </div>

          <Link href="/login" className="home-preview-nav-login hidden sm:inline-flex">
            登录
          </Link>

          <Link href="/" className="home-preview-nav-formal hidden xl:inline-flex">
            正式首页
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="home-preview-nav-icon-btn" aria-label="打开菜单">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[#0a0b0f] border-border">
              <SheetHeader>
                <SheetTitle>菜单</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {sideNavLinks.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold hover:bg-white/5"
                    onClick={() => navigate(item.href)}
                  >
                    {item.label}
                    {item.badge ? <span className="home-preview-nav-badge">{item.badge}</span> : null}
                  </button>
                ))}
                <Link
                  href="/login"
                  className="home-preview-nav-login mt-4 justify-center"
                  onClick={() => setOpen(false)}
                >
                  登录
                </Link>
                <Link
                  href="/"
                  className="mt-2 px-3 py-2 text-sm text-primary"
                  onClick={() => setOpen(false)}
                >
                  正式首页
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
