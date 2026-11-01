"use client";

import { useEffect } from "react";

/** 原型 scroll reveal：模块卡片进入视口时淡入 */
export function SiteHomeV2Motion() {
  useEffect(() => {
    const root = document.querySelector("[data-site-home-v2]");
    if (!root) return;

    const nodes = root.querySelectorAll(".module-tile, .qr-showcase-tile, .store-bar");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: [0, 0.05, 0.12], rootMargin: "0px 0px -2% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));

    const fallback = window.setTimeout(() => {
      nodes.forEach((node) => node.classList.add("is-in"));
    }, 1500);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return null;
}
