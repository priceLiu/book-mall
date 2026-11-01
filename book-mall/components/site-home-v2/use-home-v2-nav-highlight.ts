"use client";

import { useEffect, useState } from "react";

/** 与顶栏锚点导航对应的 section id（不含 #） */
export const HOME_V2_NAV_SECTION_IDS = [
  "top",
  "scenes",
  "skills",
  "quick-replica-showcase",
  "why",
  "cta",
] as const;

export type HomeV2NavSectionId = (typeof HOME_V2_NAV_SECTION_IDS)[number];

export function useHomeV2NavHighlight(enabled: boolean) {
  const [activeSection, setActiveSection] = useState<HomeV2NavSectionId>("top");

  useEffect(() => {
    if (!enabled) return;

    const headerOffset = 56;

    const syncFromScroll = () => {
      let current: HomeV2NavSectionId = "top";
      for (const id of HOME_V2_NAV_SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - headerOffset <= 8) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    syncFromScroll();
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll);
    window.addEventListener("hashchange", syncFromScroll);

    return () => {
      window.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
      window.removeEventListener("hashchange", syncFromScroll);
    };
  }, [enabled]);

  return activeSection;
}
