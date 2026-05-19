"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type NotchNavItem = {
  value: string;
  label: string;
  href?: string;
  /** 若提供，该项为下拉触发器，不触发整页跳转 */
  dropdown?: React.ReactNode;
  onDropdownOpenChange?: (open: boolean) => void;
};

type NotchNavProps = {
  items: NotchNavItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

export function NotchNav({
  items,
  value,
  defaultValue,
  onValueChange,
  ariaLabel = "主导航",
  className,
}: NotchNavProps) {
  const isControlled = value !== undefined;
  const [active, setActive] = React.useState<string>(
    value ?? defaultValue ?? items[0]?.value ?? "",
  );
  const [ready, setReady] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (isControlled && value !== undefined) setActive(value);
  }, [isControlled, value]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [notchRect, setNotchRect] = React.useState<{ left: number; width: number } | null>(null);

  const activeIndex = React.useMemo(
    () => Math.max(0, items.findIndex((i) => i.value === active)),
    [items, active],
  );

  const updateNotch = React.useCallback(() => {
    const c = containerRef.current;
    const el = itemRefs.current[activeIndex];
    if (!c || !el) return;
    const cRect = c.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const left = eRect.left - cRect.left;
    const width = eRect.width;
    setNotchRect({ left, width });
    setReady(true);
  }, [activeIndex]);

  React.useLayoutEffect(() => {
    updateNotch();
    const onResize = () => updateNotch();
    window.addEventListener("resize", onResize);
    const c = containerRef.current;
    const ro =
      typeof ResizeObserver !== "undefined" && c
        ? new ResizeObserver(() => updateNotch())
        : null;
    if (c && ro) ro.observe(c);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [updateNotch]);

  const focusItem = (index: number) => {
    const el = itemRefs.current[Math.max(0, Math.min(items.length - 1, index))];
    el?.focus();
  };

  const commitChange = (next: string) => {
    if (!isControlled) setActive(next);
    onValueChange?.(next);
  };

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const buttonClass = (isItemActive: boolean) =>
    cn(
      "relative inline-flex items-center justify-center gap-0.5 rounded-full px-3 py-2 text-sm font-medium outline-none transition-colors",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
      isItemActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav aria-label={ariaLabel} className={cn("mx-auto w-fit", className)}>
      <div
        ref={containerRef}
        className="relative rounded-full border border-border/80 bg-muted/80 text-foreground shadow-sm backdrop-blur-sm dark:bg-secondary/80"
      >
        <ul
          role="menubar"
          className="flex items-center justify-center gap-0.5 p-1"
          onKeyDown={(e) => {
            const key = e.key;
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
            e.preventDefault();
            if (key === "ArrowRight") focusItem(activeIndex + 1);
            if (key === "ArrowLeft") focusItem(activeIndex - 1);
            if (key === "Home") focusItem(0);
            if (key === "End") focusItem(items.length - 1);
          }}
        >
          {items.map((item, idx) => {
            const isActive = item.value === active;

            if (item.dropdown) {
              return (
                <li key={item.value} role="none">
                  <DropdownMenu
                    onOpenChange={(open) => {
                      item.onDropdownOpenChange?.(open);
                      if (!isControlled && open) setActive(item.value);
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        role="menuitem"
                        aria-haspopup="menu"
                        aria-expanded={undefined}
                        tabIndex={isActive ? 0 : -1}
                        className={buttonClass(isActive)}
                      >
                        <span className="text-pretty">{item.label}</span>
                        <ChevronDown className="size-3 opacity-60" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={10}
                      className="w-[min(92vw,680px)] overflow-hidden p-0"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      {item.dropdown}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            }

            return (
              <li key={item.value} role="none">
                <button
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  aria-pressed={isActive || undefined}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => commitChange(item.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      commitChange(item.value);
                    }
                  }}
                  className={buttonClass(isActive)}
                >
                  <span className="text-pretty">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {notchRect ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute overflow-hidden rounded-sm transition-all ease-[cubic-bezier(0.22,1,0.36,1)]",
              reducedMotion ? "duration-0" : "duration-300",
              ready ? "opacity-100" : "opacity-0",
            )}
            style={{
              transform: `translate3d(${notchRect.left}px, 0, 0)`,
              width: notchRect.width,
              bottom: -4,
              height: 10,
              willChange: "transform, width, opacity",
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              className="block text-foreground"
            >
              <path
                d="
                  M 2 1
                  H 98
                  Q 99 1 99 2
                  V 10
                  H 88
                  Q 87.2 10 86.6 11.4
                  L 84.8 18
                  H 15.2
                  L 13.4 11.4
                  Q 12.8 10 12 10
                  H 2
                  Q 1 10 1 9
                  V 2
                  Q 1 1 2 1
                Z
                "
                fill="currentColor"
              />
            </svg>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
