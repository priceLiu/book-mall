"use client";

import { useEffect, useRef } from "react";

/** 侧栏列表底部哨兵：接近底部时触发追加加载 */
export function usePanelInfiniteScroll(opts: {
  enabled: boolean;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void | Promise<void>;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(opts.onLoadMore);
  onLoadMoreRef.current = opts.onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !opts.enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!opts.hasMore || opts.loading || opts.loadingMore) return;
        void onLoadMoreRef.current();
      },
      { rootMargin: opts.rootMargin ?? "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    opts.enabled,
    opts.hasMore,
    opts.loading,
    opts.loadingMore,
    opts.rootMargin,
  ]);

  return sentinelRef;
}
