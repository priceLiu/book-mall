"use client";

import { Menu } from "lucide-react";
import React from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Separator } from "../ui/separator";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../ui/navigation-menu";
import { Button } from "../ui/button";
import Link from "next/link";
import Image from "next/image";
import { ToggleTheme } from "./toogle-theme";

interface RouteProps {
  href: string;
  label: string;
}

const routeList: RouteProps[] = [
  { href: "#testimonials", label: "客户评价" },
  { href: "#pricing", label: "价格" },
  { href: "/pricing-disclosure", label: "价格公示" },
  { href: "#contact", label: "联系" },
  { href: "#faq", label: "常见问题" },
];

function BrandLogoLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      className="flex items-center shrink-0"
      onClick={onNavigate}
      aria-label="智选AI 首页"
    >
      <Image
        src="/logo.jpg"
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
  return (
    <header className="sticky top-5 z-50 mx-auto flex min-h-12 w-[90%] items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/95 px-2 py-2 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-card/90 md:w-[70%] lg:w-[75%] lg:max-w-screen-xl">
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
            className="flex flex-col justify-between rounded-tr-2xl rounded-br-2xl bg-card border-secondary"
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
                    <Link href={href}>{label}</Link>
                  </Button>
                ))}
              </div>
            </div>

            <SheetFooter className="flex-col sm:flex-col justify-start items-stretch">
              <Separator className="mb-2" />
              <div className="flex flex-wrap items-center gap-2">
                {children}
                <ToggleTheme iconOnly className="shrink-0" />
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden min-h-9 min-w-0 flex-1 items-center justify-center lg:flex">
        <NavigationMenu className="relative z-10 flex max-w-max flex-1 items-center justify-center">
          <NavigationMenuList className="flex items-center gap-1">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-9 bg-card px-3 text-base">
                产品
              </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="flex w-[680px] gap-6 p-4">
                <Image
                  src="/logo.jpg"
                  alt="智选AI"
                  className="h-44 w-44 shrink-0 rounded-md object-contain bg-transparent dark:mix-blend-screen"
                  width={400}
                  height={400}
                />
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                  <NavigationMenuLink asChild>
                    <Link
                      href="/products/ai-apps"
                      className="rounded-md border border-transparent p-4 hover:border-secondary hover:bg-muted flex flex-col justify-center min-h-[120px]"
                    >
                      <p className="mb-1 font-semibold leading-none text-foreground">AI 应用</p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        工具型产品与在线应用
                      </p>
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/products/ai-courses"
                      className="rounded-md border border-transparent p-4 hover:border-secondary hover:bg-muted flex flex-col justify-center min-h-[120px]"
                    >
                      <p className="mb-1 font-semibold leading-none text-foreground">
                        AI 课程（导购）
                      </p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        商品化的课程产品介绍
                      </p>
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/courses"
                      className="col-span-2 rounded-md border border-transparent p-4 hover:border-secondary hover:bg-muted flex flex-col justify-center min-h-[96px]"
                    >
                      <p className="mb-1 font-semibold leading-none text-foreground">AI 学堂</p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        课程站占位路由 · 后续接入学习与订阅权益
                      </p>
                    </Link>
                  </NavigationMenuLink>
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            {routeList.map(({ href, label }) => (
              <NavigationMenuLink key={href} asChild>
                <Link href={href} className="inline-flex h-9 items-center px-2 text-base">
                  {label}
                </Link>
              </NavigationMenuLink>
            ))}
          </NavigationMenuItem>
        </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="hidden h-9 shrink-0 items-center gap-2 lg:flex">
        {children}
        <ToggleTheme iconOnly className="shrink-0" />
      </div>
    </header>
  );
}
