"use client";

import { Menu } from "lucide-react";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProductMegaMenuContent } from "@/components/layout/product-mega-menu";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { NotchNav, type NotchNavItem } from "../ui/notch-nav";
import { ToggleTheme } from "./toogle-theme";
import { siteHeaderWidthClass } from "@/lib/site-layout";
import { cn } from "@/lib/utils";
import { PRODUCTION_BRAND_PORTAL_ORIGIN } from "@/lib/production-origin";

/** 与 NotchNav 中「产品」项 value 一致，用于凹槽高亮与路由判断 */
const NAV_PRODUCT_VALUE = "__nav_products__";

interface RouteProps {
  href: string;
  label: string;
}

const routeList: RouteProps[] = [
  { href: "#hero-video", label: "主屏" },
  { href: "#testimonials", label: "客户评价" },
  { href: "/pricing", label: "报价" },
];

function BrandLogoLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href={PRODUCTION_BRAND_PORTAL_ORIGIN}
      className="flex shrink-0 items-center"
      onClick={onNavigate}
      aria-label="智选 AI — ai-code8.com"
    >
      <Image
        src="/logo2.png"
        alt="智选AI — ai-code8.com"
        width={144}
        height={144}
        className="h-9 w-9 object-contain bg-transparent dark:mix-blend-screen"
        priority
      />
    </Link>
  );
}

export function NavbarShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [productMenuOpen, setProductMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [hash, setHash] = React.useState("");

  React.useEffect(() => {
    const read = () => setHash(typeof window !== "undefined" ? window.location.hash : "");
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, [pathname]);

  const isProductPath =
    pathname.startsWith("/products/") ||
    pathname === "/courses" ||
    pathname.startsWith("/courses/");

  const notchAnchorValue = React.useMemo(() => {
    if (isProductPath || productMenuOpen) return NAV_PRODUCT_VALUE;
    if (pathname !== "/") return routeList[0]?.href ?? "";
    const hit = routeList.find((r) => r.href === hash);
    return hit?.href ?? routeList[0]?.href ?? "";
  }, [pathname, hash, isProductPath, productMenuOpen]);

  const notchItems = React.useMemo((): NotchNavItem[] => {
    return [
      {
        value: NAV_PRODUCT_VALUE,
        label: "产品",
        dropdown: <ProductMegaMenuContent />,
        onDropdownOpenChange: setProductMenuOpen,
      },
      ...routeList.map((r) => ({ value: r.href, label: r.label })),
    ];
  }, []);

  const navigateNotch = React.useCallback(
    (href: string) => {
      setProductMenuOpen(false);
      if (href === NAV_PRODUCT_VALUE) return;

      if (href.startsWith("#")) {
        setHash(href);
        const target = `/${href}`;
        const sectionId = href.slice(1);

        if (pathname === "/") {
          void router.push(target, { scroll: false });
          requestAnimationFrame(() => {
            document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
          });
          return;
        }

        void router.push(target);
        router.refresh();
        return;
      }

      void router.push(href);
    },
    [pathname, router],
  );

  return (
    <header
      className={cn(
        "sticky top-5 z-50 flex min-h-12 items-center justify-between gap-3 overflow-visible rounded-2xl border border-border/80 bg-card/95 px-2 py-2 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-card/90",
        siteHeaderWidthClass,
      )}
    >
      <div className="flex h-9 shrink-0 items-center">
        <BrandLogoLink />
      </div>

      <div className="flex h-9 shrink-0 items-center lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Menu
              onClick={() => setIsOpen(!isOpen)}
              className="cursor-pointer lg:hidden"
            />
          </SheetTrigger>

          <SheetContent
            side="left"
            className="flex flex-col justify-between rounded-tr-2xl rounded-br-2xl border-secondary bg-card"
          >
            <div>
              <SheetHeader className="mb-4 ml-4">
                <SheetTitle className="flex items-center">
                  <BrandLogoLink onNavigate={() => setIsOpen(false)} />
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-2">
                <p className="px-2 text-xs font-medium text-muted-foreground">产品</p>
                <Button
                  onClick={() => setIsOpen(false)}
                  asChild
                  variant="ghost"
                  className="justify-start text-base"
                >
                  <Link href="/products/ai-apps">AI 应用</Link>
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  asChild
                  variant="ghost"
                  className="justify-start text-base"
                >
                  <Link href="/products/ai-courses">AI 课程</Link>
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  asChild
                  variant="ghost"
                  className="justify-start text-base"
                >
                  <Link href="/courses">AI 学堂</Link>
                </Button>
              </div>
              <Separator className="my-2" />
              <div className="flex flex-col gap-2">
                {routeList.map(({ href, label }) => (
                  <Button
                    key={href}
                    onClick={() => setIsOpen(false)}
                    asChild
                    variant="ghost"
                    className="justify-start text-base"
                  >
                    <Link href={href.startsWith("#") ? `/${href}` : href}>{label}</Link>
                  </Button>
                ))}
              </div>
            </div>

            <SheetFooter className="flex-col justify-start items-stretch sm:flex-col">
              <Separator className="mb-2" />
              <div className="flex flex-wrap items-center gap-2">
                {children}
                <ToggleTheme iconOnly className="shrink-0" />
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden min-h-9 min-w-0 flex-1 items-center justify-center overflow-visible lg:flex">
        <NotchNav
          key={pathname}
          items={notchItems}
          value={notchAnchorValue}
          onValueChange={navigateNotch}
          ariaLabel="主导航"
          className="shrink-0"
        />
      </div>

      <div className="hidden h-9 shrink-0 items-center gap-2 lg:flex">
        {children}
        <ToggleTheme iconOnly className="shrink-0" />
      </div>
    </header>
  );
}
