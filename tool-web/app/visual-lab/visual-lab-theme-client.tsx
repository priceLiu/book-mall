"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Maximize2, Minimize2, Moon, Sun } from "lucide-react";

export type VisualLabThemeMode = "dark" | "light";

const STORAGE_KEY = "visual-lab-theme";

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
  const isAnalysisPage = pathname === "/visual-lab/analysis";

  const [mode, setMode] = useState<VisualLabThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    setMode(readInitial());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (isAnalysisPage) {
      setImmersive(true);
    } else {
      setImmersive(false);
    }
  }, [isAnalysisPage]);

  useEffect(() => {
    toggleToolRootImmersive(immersive && isAnalysisPage);
    return () => toggleToolRootImmersive(false);
  }, [immersive, isAnalysisPage]);

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
    "visual-lab-theme-root" +
    (immersive && isAnalysisPage ? " visual-lab-immersive-active" : "");

  return (
    <div className={rootClass} data-theme={hydrated ? mode : "dark"} suppressHydrationWarning>
      <div className="vl-floating-toolbar">
        {isAnalysisPage ? (
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
      {children}
    </div>
  );
}
