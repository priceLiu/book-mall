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
  isActive?: (pathname: string) => boolean;
};

const centerNavLinks: NavItem[] = [
  { label: "主屏", href: "#hero-video" },
  { label: "客户评价", href: "#testimonials" },
  {
    label: "报价",
    href: "/pricing",
    isActive: (p) => p === "/pricing" || p.startsWith("/pricing/"),
  },
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
    <>
      <header className="site-home-nav w-full">
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
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>

          <nav className="site-home-nav-center hidden lg:flex" aria-label="主导航">
            <SiteHomeProductNav variant="link" />

            {centerNavLinks.map((item) => {
              const active = item.isActive?.(pathname) ?? false;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={cn("site-home-nav-link", active && "site-home-nav-link-active")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="site-home-nav-opts flex items-center justify-end">
            <ToggleTheme
              iconOnly
              className="site-home-nav-icon-btn hidden sm:inline-flex"
            />

            <div
              className={cn(
                "site-home-nav-auth-wrap",
                !isLoggedIn && "hidden sm:block",
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
                <SheetContent side="right" className="border-border bg-background">
                  <SheetHeader>
                    <SheetTitle>菜单</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-1">
                    <p className="px-3 text-xs font-medium text-muted-foreground">产品</p>
                    {SITE_HOME_PRODUCT_OPTIONS.map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        className="site-home-nav-sheet-item flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                        onClick={() => navigate(item.href)}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">{item.description}</span>
                      </button>
                    ))}
                    <div className="my-2 border-t border-border/60" />
                    {centerNavLinks.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="site-home-nav-sheet-item flex items-center gap-2 rounded-md px-3 py-2.5 text-left hover:bg-muted"
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
      <div className="site-home-nav-spacer" aria-hidden />
    </>
  );
}
