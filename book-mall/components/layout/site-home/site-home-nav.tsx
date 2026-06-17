"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { PRODUCTION_BRAND_PORTAL_ORIGIN } from "@/lib/production-origin";
import { cn } from "@/lib/utils";
import {
  SITE_HOME_PRODUCT_OPTIONS,
  SiteHomeProductNav,
} from "@/components/layout/site-home/site-home-product-nav";
import { ToggleTheme } from "@/components/layout/toogle-theme";
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
};

const anchorNavLinks: NavItem[] = [
  { label: "主屏", href: "#hero-video" },
  { label: "客户评价", href: "#testimonials" },
  { label: "报价", href: "/pricing", badge: "积分" },
];

export function SiteHomeNav({
  children,
  isLoggedIn,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navigate = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) {
      if (pathname === "/") {
        document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
        window.history.replaceState(null, "", href);
        return;
      }
      router.push(`/${href}`);
      return;
    }
    router.push(href);
  };

  return (
    <header className="site-home-nav sticky top-0 z-[999] w-full border-b">
      <div className="site-home-nav-container">
        <Link
          href={PRODUCTION_BRAND_PORTAL_ORIGIN}
          className="site-home-nav-logo shrink-0"
          aria-label="智选 AI — ai-code8.com"
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

        <nav className="site-home-side-nav hidden lg:flex" aria-label="主导航">
          <div className="site-home-side-nav-item site-home-side-nav-item-first">
            <SiteHomeProductNav />
          </div>

          {anchorNavLinks.map((item) => (
            <div key={item.label} className="site-home-side-nav-item">
              <button type="button" onClick={() => navigate(item.href)} className="site-home-nav-link">
                <span>{item.label}</span>
                {item.badge ? <span className="site-home-nav-badge">{item.badge}</span> : null}
              </button>
            </div>
          ))}
        </nav>

        <div className="site-home-nav-opts ml-auto flex items-center">
          <ToggleTheme
            iconOnly
            className="site-home-nav-icon-btn hidden h-9 w-9 text-[hsl(215,16%,65%)] hover:bg-transparent hover:text-foreground sm:inline-flex [&_svg]:size-5"
          />

          <div
            className={cn(
              "site-home-nav-auth flex flex-wrap items-center justify-end gap-2",
              !isLoggedIn && "hidden sm:flex",
            )}
          >
            {children}
          </div>

          {!isLoggedIn && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="site-home-nav-icon-btn" aria-label="打开菜单">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-[#0a0b0f] border-border">
                <SheetHeader>
                  <SheetTitle>菜单</SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-1">
                  <p className="px-3 text-xs font-medium text-muted-foreground">产品</p>
                  {SITE_HOME_PRODUCT_OPTIONS.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      className="flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-left hover:bg-white/5"
                      onClick={() => navigate(item.href)}
                    >
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </button>
                  ))}
                  <div className="my-2 border-t border-border/60" />
                  {anchorNavLinks.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold hover:bg-white/5"
                      onClick={() => navigate(item.href)}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">{children}</div>
                  <Link
                    href="/login"
                    className="site-home-nav-login mt-2 justify-center"
                    onClick={() => setOpen(false)}
                  >
                    登录
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}
