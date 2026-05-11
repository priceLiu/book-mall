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
import { NavbarAuth } from "./navbar-auth";

interface RouteProps {
  href: string;
  label: string;
}

const routeList: RouteProps[] = [
  {
    href: "#testimonials",
    label: "客户评价",
  },
  {
    href: "#pricing",
    label: "价格",
  },
  {
    href: "#team",
    label: "团队",
  },
  {
    href: "#contact",
    label: "联系",
  },
  {
    href: "#faq",
    label: "常见问题",
  },
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

export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <header className="sticky top-5 z-50 mx-auto flex w-[90%] items-center justify-between rounded-2xl border border-border/80 bg-card/95 p-2 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-card/90 md:w-[70%] lg:w-[75%] lg:max-w-screen-xl">
      <BrandLogoLink />

      {/* <!-- Mobile --> */}
      <div className="flex items-center lg:hidden">
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

            <SheetFooter className="flex-col sm:flex-col justify-start items-start">
              <Separator className="mb-2" />
              <div className="flex flex-wrap items-center gap-2">
                <ToggleTheme />
                <NavbarAuth />
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* <!-- Desktop --> */}
      <NavigationMenu className="hidden lg:block mx-auto">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="bg-card text-base">
              产品
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="grid w-[600px] grid-cols-2 gap-5 p-4">
                <Image
                  src="/logo.jpg"
                  alt="智选AI"
                  className="h-full w-full rounded-md object-contain aspect-square bg-transparent dark:mix-blend-screen"
                  width={400}
                  height={400}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NavigationMenuLink asChild>
                    <Link
                      href="/products/ai-apps"
                      className="rounded-md p-4 hover:bg-muted flex flex-col justify-center min-h-[120px] border border-transparent hover:border-secondary"
                    >
                      <p className="mb-1 font-semibold leading-none text-foreground">
                        AI 应用
                      </p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        工具型产品与在线应用
                      </p>
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/products/ai-courses"
                      className="rounded-md p-4 hover:bg-muted flex flex-col justify-center min-h-[120px] border border-transparent hover:border-secondary"
                    >
                      <p className="mb-1 font-semibold leading-none text-foreground">
                        AI 课程
                      </p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        知识型课程与学习内容
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
                <Link href={href} className="text-base px-2">
                  {label}
                </Link>
              </NavigationMenuLink>
            ))}
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <div className="hidden lg:flex items-center gap-2">
        <ToggleTheme />
        <NavbarAuth />
      </div>
    </header>
  );
};
