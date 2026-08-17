"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { PRODUCTION_BRAND_PORTAL_ORIGIN } from "@/lib/production-origin";
import { cn } from "@/lib/utils";
import {
  SiteHomeProductNav,
} from "@/components/layout/site-home/site-home-product-nav";
import { buildBookPortalNavItems } from "@/lib/portal-nav";
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
    label: "订阅价格",
    href: "/pricing",
    isActive: (p) => p === "/pricing",
  },
  {
    label: "API 价格",
    href: "/pricing/api",
    isActive: (p) => p === "/pricing/api" || p.startsWith("/pricing/api/"),
  },
];

export function SiteHomeNav({
  children,
  isLoggedIn,
  variant = "marketing",
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  variant?: "marketing" | "account";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isAccount = variant === "account";
  const navLinkClass = isAccount ? "site-app-nav-link" : "site-home-nav-link";
  const navLinkActiveClass = isAccount ? "site-app-nav-link-active" : "site-home-nav-link-active";

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

  const portalNavLinks = (
    <>
      <SiteHomeProductNav
        variant="link"
        linkClassName={navLinkClass}
        linkActiveClassName={navLinkActiveClass}
      />
      {centerNavLinks.map((item) => {
        const active = item.isActive?.(pathname) ?? false;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.href)}
            className={cn(navLinkClass, active && navLinkActiveClass)}
          >
            {item.label}
          </button>
        );
      })}
    </>
  );

  const authAndMobile = (
    <>
      <ToggleTheme
        iconOnly
        className={cn(
          "hidden sm:inline-flex",
          isAccount ? "site-app-topnav-icon-btn" : "site-home-nav-icon-btn",
        )}
      />

      <div
        className={cn(
          isAccount ? "flex items-center" : "site-home-nav-auth-wrap",
          !isLoggedIn && "hidden sm:block",
        )}
      >
        {children}
      </div>

      {(!isLoggedIn || isAccount) && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className={isAccount ? "site-app-topnav-icon-btn" : "site-home-nav-icon-btn"}
              aria-label="打开菜单"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="border-border bg-background">
            <SheetHeader>
              <SheetTitle>菜单</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-1">
              <p className="px-3 text-xs font-medium text-muted-foreground">产品</p>
              {buildBookPortalNavItems().map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="site-home-nav-sheet-item flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
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
              {!isLoggedIn ? (
                <>
                  <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">{children}</div>
                  <Link
                    href="/login"
                    className="site-home-nav-login mt-2 justify-center"
                    onClick={() => setOpen(false)}
                  >
                    登录
                  </Link>
                </>
              ) : (
                <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">{children}</div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );

  if (isAccount) {
    return (
      <header className="site-app-subheader site-app-topnav sticky top-0 z-40 w-full">
        <div className="site-app-topnav-container">
          <div className="site-app-topnav-spacer" aria-hidden />
          <div className="site-app-topnav-leading">
            <Link
              href={PRODUCTION_BRAND_PORTAL_ORIGIN}
              className="site-app-topnav-logo shrink-0"
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
            <nav className="site-app-topnav-center hidden lg:flex" aria-label="主导航">
              {portalNavLinks}
            </nav>
          </div>
          <div className="site-app-topnav-opts">{authAndMobile}</div>
        </div>
      </header>
    );
  }

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
            {portalNavLinks}
          </nav>

          <div className="site-home-nav-opts flex items-center justify-end">{authAndMobile}</div>
        </div>
      </header>
      <div className="site-home-nav-spacer" aria-hidden />
    </>
  );
}
