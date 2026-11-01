"use client";

import { useEffect } from "react";

const HTML_CLASS = "site-home-v2-page";

/** 挂载时在 html 打标，便于隐藏滚动条并避免与旧 data-site-home 样式冲突 */
export function SiteHomeV2Root({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add(HTML_CLASS);
    return () => html.classList.remove(HTML_CLASS);
  }, []);

  return children;
}
