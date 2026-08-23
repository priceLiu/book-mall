"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Braces,
  CreditCard,
  Layers,
  LayoutGrid,
  Menu,
  MessageSquareText,
  Monitor,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PRODUCTION_BRAND_PORTAL_ORIGIN } from "@/lib/production-origin";
import { cn } from "@/lib/utils";
import { buildBookPortalNavItems, BOOK_PORTAL_EXTERNAL_LINK_PROPS, marketingHomeSectionUrl } from "@/lib/portal-nav";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import { Button } from "@/components/ui/button";
import {
  TubelightNavBar,
  type TubelightNavItem,
} from "@/components/ui/tubelight-navbar";
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
  { label: "平台应用", href: "#platform-apps" },
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

const centerNavIcons: Record<string, TubelightNavItem["icon"]> = {
  主屏: Monitor,
  平台应用: LayoutGrid,
  客户评价: MessageSquareText,
  订阅价格: CreditCard,
  "API 价格": Braces,
};

function ProductNavDropdown({ isLoggedIn }: { isLoggedIn: boolean }) {
  const items = buildBookPortalNavItems(undefined, isLoggedIn);
  return (
    <div className="flex flex-col gap-0.5 p-1">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
          className="site-home-nav-sheet-item rounded-md px-3 py-2.5 hover:bg-muted"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

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
  const [productOpen, setProductOpen] = useState(false);
  const [hash, setHash] = useState("");
  const isAccount = variant === "account";

  useEffect(() => {
    const read = () =>
      setHash(typeof window !== "undefined" ? window.location.hash : "");
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, [pathname]);

  const navigate = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) {
      const openMarketingInNewTab = isAccount || pathname !== "/";
      if (openMarketingInNewTab) {
        window.open(
          marketingHomeSectionUrl(window.location.origin, href),
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
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

  const activeNavName = useMemo(() => {
    if (productOpen) return "产品";
    const pricingApi = centerNavLinks.find((l) => l.label === "API 价格");
    const pricing = centerNavLinks.find((l) => l.label === "订阅价格");
    if (pricingApi?.isActive?.(pathname)) return "API 价格";
    if (pricing?.isActive?.(pathname)) return "订阅价格";
    if (pathname === "/") {
      if (hash === "#testimonials") return "客户评价";
      if (hash === "#platform-apps") return "平台应用";
      return "主屏";
    }
    return "主屏";
  }, [pathname, hash, productOpen]);

  const tubelightItems = useMemo((): TubelightNavItem[] => {
    return [
      {
        name: "产品",
        icon: Layers,
        dropdown: <ProductNavDropdown isLoggedIn={isLoggedIn} />,
        onDropdownOpenChange: setProductOpen,
      },
      ...centerNavLinks.map((item) => ({
        name: item.label,
        url: item.href,
        icon: centerNavIcons[item.label] ?? Monitor,
      })),
    ];
  }, [isLoggedIn]);

  const handleTubelightNavigate = (item: TubelightNavItem) => {
    if (item.url) navigate(item.url);
  };

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
              {buildBookPortalNavItems(undefined, isLoggedIn).map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
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
              <TubelightNavBar
                items={tubelightItems}
                activeName={activeNavName}
                onNavigate={handleTubelightNavigate}
              />
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

          <div className="site-home-nav-center hidden lg:flex">
            <TubelightNavBar
              items={tubelightItems}
              activeName={activeNavName}
              onNavigate={handleTubelightNavigate}
            />
          </div>

          <div className="site-home-nav-opts flex items-center justify-end">{authAndMobile}</div>
        </div>
      </header>
      <div className="site-home-nav-spacer" aria-hidden />
    </>
  );
}
