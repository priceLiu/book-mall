"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 进入视口（或接近视口）后再加载媒体，避免打开画布时几十张图/视频同时解码卡主线程。
 */
export function useLazyMediaActive<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "240px",
  /** 已知已加载过的 src：跳过 IO 等待，避免 onlyRenderVisibleElements 重挂载时灰底闪烁 */
  eager = false,
) {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(eager);

  useEffect(() => {
    if (eager && !active) {
      setActive(true);
    }
  }, [eager, active]);

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
