"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { CANVAS_PROJECTS_SUB_NAV } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function isMyCanvasHubPath(pathname: string): boolean {
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
  return CANVAS_PROJECTS_SUB_NAV.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/** 顶栏「我的画布」：主链到画布列表，子入口下拉 */
export function MyCanvasNavDropdown() {
  const pathname = usePathname() || "/";
  const active = isMyCanvasHubPath(pathname);
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  const syncMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({ top: rect.bottom + 6, left: rect.left });
  }, []);

  const openMenu = useCallback(() => {
    syncMenuPosition();
    setOpen(true);
  }, [syncMenuPosition]);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    syncMenuPosition();
    const onScrollOrResize = () => syncMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, syncMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (document.getElementById("my-canvas-nav-menu")?.contains(t)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  const menuPanel =
    open && menuRect && mounted ? (
      <div
        id="my-canvas-nav-menu"
        role="menu"
        style={{ top: menuRect.top, left: menuRect.left }}
        className="fixed z-[200] min-w-[11rem] rounded-xl border border-white/10 bg-[#1f1f1f] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      >
        {CANVAS_PROJECTS_SUB_NAV.map((item) => {
          const subActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              role="menuitem"
              className={cn(
                "block px-3 py-2 text-sm transition",
                subActive
                  ? "bg-[var(--canvas-accent)]/15 text-white"
                  : "text-white/75 hover:bg-white/5 hover:text-white",
              )}
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div
        className={cn(
          "canvas-sans flex items-stretch overflow-hidden rounded-full text-xs font-semibold tracking-tight transition sm:text-sm",
          active || open
            ? "bg-white/12 text-white ring-1 ring-white/15"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        <Link href="/projects" scroll={false} className="px-2.5 py-1.5 sm:px-3">
          我的画布
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls="my-canvas-nav-menu"
          aria-label="我的画布更多入口"
          className="border-l border-white/10 px-1.5 py-1.5 transition hover:bg-white/5 sm:px-2"
          onClick={() => (open ? closeMenu() : openMenu())}
        >
          <ChevronDown
            className={cn("size-3.5 opacity-80 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {menuPanel && typeof document !== "undefined"
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}