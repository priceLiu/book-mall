"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface TubelightNavItem {
  name: string;
  url?: string;
  icon: LucideIcon;
  /** 下拉内容；提供时该项为触发器，不直接跳转 */
  dropdown?: React.ReactNode;
  onDropdownOpenChange?: (open: boolean) => void;
}

interface TubelightNavBarProps {
  items: TubelightNavItem[];
  activeName: string;
  onNavigate?: (item: TubelightNavItem) => void;
  className?: string;
}

export function TubelightNavBar({
  items,
  activeName,
  onNavigate,
  className,
}: TubelightNavBarProps) {
  const itemClass = (isActive: boolean) =>
    cn(
      "relative z-0 inline-flex cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors lg:px-6",
      "text-foreground/70 hover:text-foreground",
      isActive && "text-foreground",
    );

  const lamp = (isActive: boolean) =>
    isActive ? (
      <motion.div
        layoutId="tubelight-lamp"
        className="absolute inset-0 -z-10 w-full rounded-full bg-muted/60"
        initial={false}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-1 w-8 rounded-t-full bg-foreground">
          <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-foreground/15 blur-md" />
          <div className="absolute -top-1 h-6 w-8 rounded-full bg-foreground/15 blur-md" />
          <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-foreground/20 blur-sm" />
        </div>
      </motion.div>
    ) : null;

  return (
    <nav
      aria-label="主导航"
      className={cn("inline-flex", className)}
    >
      <div
        className="flex items-center gap-0.5 rounded-full border border-gray-200/90 bg-white px-1 py-1 shadow-lg shadow-black/[0.06]"
      >
        {items.map((item) => {
          const isActive = activeName === item.name;

          if (item.dropdown) {
            return (
              <DropdownMenu
                key={item.name}
                onOpenChange={item.onDropdownOpenChange}
              >
                <DropdownMenuTrigger asChild>
                  <button type="button" className={itemClass(isActive)}>
                    <span className="inline-flex items-center gap-1">
                      {item.name}
                      <ChevronDown className="size-3.5 opacity-60" aria-hidden />
                    </span>
                    {lamp(isActive)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={10}>
                  {item.dropdown}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <button
              key={item.name}
              type="button"
              className={itemClass(isActive)}
              onClick={() => onNavigate?.(item)}
            >
              <span>{item.name}</span>
              {lamp(isActive)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
