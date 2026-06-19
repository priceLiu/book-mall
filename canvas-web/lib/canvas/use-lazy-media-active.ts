"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 进入视口（或接近视口）后再加载媒体，避免打开画布时几十张图/视频同时解码卡主线程。
 */
export function useLazyMediaActive<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "240px",
) {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, rootMargin]);

  return { ref, active };
}
