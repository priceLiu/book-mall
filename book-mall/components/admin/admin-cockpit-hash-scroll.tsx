"use client";

import { useEffect } from "react";

/** 支持 /admin#today、/admin#metrics 等锚点定位 */
export function AdminCockpitHashScroll() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
