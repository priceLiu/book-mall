"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Maximize2, Minimize2, Moon, Sun } from "lucide-react";

export type VisualLabThemeMode = "dark" | "light";

const STORAGE_KEY = "visual-lab-theme";

/** 与侧栏一致：首页、分析室、成果展；进入任一子页默认沉浸式，子页间切换保留全屏开关 */
export const VISUAL_LAB_IMMERSIVE_HREFS = [
  { href: "/visual-lab", label: "首页" },
  { href: "/visual-lab/analysis", label: "分析室" },
  { href: "/visual-lab/gallery", label: "成果展" },
] as const;

export function isVisualLabImmersivePath(pathname: string): boolean {
  return VISUAL_LAB_IMMERSIVE_HREFS.some((x) => x.href === pathname);
}

function readInitial(): VisualLabThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

function toggleToolRootImmersive(on: boolean) {
  const root = document.querySelector(".tool-root");
  if (!root) return;
  root.classList.toggle("visual-lab-immersive", on);
}

export function VisualLabThemeClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const immersiveEligible = isVisualLabImmersivePath(pathname);
  const prevPathRef = useRef<string | null>(null);

  const [mode, setMode] = useState<VisualLabThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    setMode(readInitial());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    const nowImm = isVisualLabImmersivePath(pathname);
    const prevImm = prev != null && isVisualLabImmersivePath(prev);

    if (!nowImm) {
      setImmersive(false);
      return;
    }
    if (!prevImm) {
      setImmersive(true);
    }
  }, [pathname]);

  const immersiveOn = immersive && immersiveEligible;

  useEffect(() => {
    toggleToolRootImmersive(immersiveOn);
    return () => toggleToolRootImmersive(false);
  }, [immersiveOn]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: VisualLabThemeMode = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleImmersive = useCallback(() => {
    setImmersive((v) => !v);
  }, []);

  const rootClass =
    "visual-lab-theme-root" + (immersiveOn ? " visual-lab-immersive-active" : "");

  return (
    <div className={rootClass} data-theme={hydrated ? mode : "dark"} suppressHydrationWarning>
      <div className="vl-floating-toolbar">
        {immersiveOn ? (
          <nav className="vl-immersive-subnav" aria-label="视觉实验室子页">
            {VISUAL_LAB_IMMERSIVE_HREFS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={
                  pathname === href
                    ? "vl-immersive-subnav-link vl-immersive-subnav-link--active"
                    : "vl-immersive-subnav-link"
                }
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="vl-floating-toolbar-trailing">
          {immersiveEligible ? (
            <button
              type="button"
              className="vl-immersive-toggle"
              onClick={toggleImmersive}
              aria-label={immersive ? "退出全屏" : "全屏"}
              title={immersive ? "退出全屏" : "全屏"}
            >
              {immersive ? (
                <Minimize2 className="vl-immersive-toggle-icon" strokeWidth={2} />
              ) : (
                <Maximize2 className="vl-immersive-toggle-icon" strokeWidth={2} />
              )}
              <span className="sr-only">{immersive ? "退出全屏" : "全屏"}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="vl-theme-toggle"
            onClick={toggle}
            aria-label={mode === "dark" ? "开灯（浅色背景）" : "关灯（深色背景）"}
            title={mode === "dark" ? "开灯" : "关灯"}
          >
            <span className="vl-theme-toggle-icons" aria-hidden>
              <Sun className="vl-theme-toggle-icon vl-theme-toggle-icon--sun" strokeWidth={2} />
              <Moon className="vl-theme-toggle-icon vl-theme-toggle-icon--moon" strokeWidth={2} />
            </span>
            <span className="sr-only">{mode === "dark" ? "开灯" : "关灯"}</span>
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
