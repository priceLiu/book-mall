"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 把弹层 children 通过 React Portal 直接挂到 `document.body`。
 *
 * 这是为了绕开 ancestor 上可能的 `transform` / `filter` / `backdrop-filter`
 * 等 CSS 属性 —— 这些会让 `position: fixed` 的子元素相对该 ancestor 而非
 * 视口定位，从而出现「弹层遮罩盖不住顶部 header」之类的诡异问题。
 *
 * SSR 安全：只有在客户端 mount 后才 render，避免 hydration mismatch。
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
