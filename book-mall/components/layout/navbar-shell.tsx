"use client";

import { Braces, CreditCard, Layers, Menu, MessageSquareText, Monitor } from "lucide-react";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProductMegaMenuContent } from "@/components/layout/product-mega-menu";
import { buildBookPortalNavItems } from "@/lib/portal-nav";
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
import {
  TubelightNavBar,
  type TubelightNavItem,
} from "../ui/tubelight-navbar";
import { ToggleTheme } from "./toogle-theme";
import { siteHeaderWidthClass } from "@/lib/site-layout";
import { cn } from "@/lib/utils";
import { PRODUCTION_BRAND_PORTAL_ORIGIN } from "@/lib/production-origin";

/** 与 TubelightNav「产品」项 name 一致 */
const NAV_PRODUCT_LABEL = "产品";

interface RouteProps {
  href: string;
  label: string;
}

const routeList: RouteProps[] = [
  { href: "#hero-video", label: "主屏" },
  { href: "#testimonials", label: "客户评价" },
  { href: "/pricing", label: "订阅价格" },
  { href: "/pricing/api", label: "API 价格" },
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

  const activeNavName = React.useMemo(() => {
    if (productMenuOpen) return NAV_PRODUCT_LABEL;
    if (pathname === "/pricing/api" || pathname.startsWith("/pricing/api/")) return "API 价格";
    if (pathname === "/pricing") return "订阅价格";
    if (pathname === "/") {
      const hit = routeList.find((r) => r.href === hash);
      return hit?.label ?? "主屏";
    }
    return "主屏";
  }, [pathname, hash, productMenuOpen]);

  const tubelightItems = React.useMemo((): TubelightNavItem[] => {
    const icons: Record<string, TubelightNavItem["icon"]> = {
      主屏: Monitor,
      客户评价: MessageSquareText,
      订阅价格: CreditCard,
      "API 价格": Braces,
    };
    return [
      {
        name: NAV_PRODUCT_LABEL,
        icon: Layers,
        dropdown: <ProductMegaMenuContent />,
        onDropdownOpenChange: setProductMenuOpen,
      },
      ...routeList.map((r) => ({
        name: r.label,
        url: r.href,
        icon: icons[r.label] ?? Monitor,
      })),
    ];
  }, []);

  const handleTubelightNavigate = React.useCallback(
    (item: TubelightNavItem) => {
      if (!item.url) return;
      setProductMenuOpen(false);

      if (item.url.startsWith("#")) {
        setHash(item.url);
        const sectionId = item.url.slice(1);

        if (pathname === "/") {
          void router.push(`/${item.url}`, { scroll: false });
          requestAnimationFrame(() => {
            document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
          });
          return;
        }

        void router.push(`/${item.url}`);
        router.refresh();
        return;
      }

      void router.push(item.url);
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
                {buildBookPortalNavItems().map((item) => (
                  <Button
                    key={item.key}
                    onClick={() => setIsOpen(false)}
                    asChild
                    variant="ghost"
                    className="justify-start text-base"
                  >
                    <a href={item.href}>{item.label}</a>
                  </Button>
                ))}
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
        <TubelightNavBar
          items={tubelightItems}
          activeName={activeNavName}
          onNavigate={handleTubelightNavigate}
        />
      </div>

      <div className="hidden h-9 shrink-0 items-center gap-2 lg:flex">
        {children}
        <ToggleTheme iconOnly className="shrink-0" />
      </div>
    </header>
  );
}
