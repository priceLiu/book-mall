"use client";

import { useEffect, useRef, useState } from "react";

/** 元素进入视口（含 rootMargin 预加载区）后保持 true，用于画廊懒加载封面 */
export function useIntersectionVisible<T extends Element = HTMLElement>(
  rootMargin = "320px 0px",
) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
