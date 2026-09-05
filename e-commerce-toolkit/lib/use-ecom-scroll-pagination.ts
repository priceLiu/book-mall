"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_PAGE_SIZE = 36;
const DEFAULT_SCROLL_THRESHOLD_PX = 280;
/** 滚动加载态最短展示，避免闪烁（参考 QuickReplica 画廊） */
const MIN_LOADING_MS = 320;

type Options = {
  total: number;
  pageSize?: number;
  /** 筛选变化时重置可见数量 */
  resetKey?: string | number;
  scrollThresholdPx?: number;
};

export function useEcomScrollPagination({
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey = "",
  scrollThresholdPx = DEFAULT_SCROLL_THRESHOLD_PX,
}: Options) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadLockRef = useRef(false);
  const loadingStartedAtRef = useRef(0);

  const hasMore = visibleCount < total;

  // 仅筛选变化时重置；total 增长（如导入实时追加）时不重置，避免列表跳回首屏
  useEffect(() => {
    setVisibleCount(pageSize);
    setLoadingMore(false);
  }, [resetKey, pageSize]);

  const loadMore = useCallback(() => {
    if (loadLockRef.current || loadingMore || visibleCount >= total) return;
    loadLockRef.current = true;
    loadingStartedAtRef.current = Date.now();
    setLoadingMore(true);
    setVisibleCount((n) => Math.min(n + pageSize, total));
    queueMicrotask(() => {
      loadLockRef.current = false;
    });
  }, [loadingMore, pageSize, total, visibleCount]);

  useEffect(() => {
    if (!loadingMore) return;
    const elapsed = Date.now() - loadingStartedAtRef.current;
    const delay = Math.max(0, MIN_LOADING_MS - elapsed);
    const id = window.setTimeout(() => setLoadingMore(false), delay);
    return () => window.clearTimeout(id);
  }, [visibleCount, loadingMore]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || total === 0 || !hasMore) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight - scrollTop - clientHeight <= scrollThresholdPx) {
        loadMore();
      }
    };

    root.addEventListener("scroll", onScroll, { passive: true });

    const sentinel = sentinelRef.current;
    let observer: IntersectionObserver | null = null;
    if (sentinel) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) loadMore();
        },
        { root, rootMargin: "240px", threshold: 0 },
      );
      observer.observe(sentinel);
    }

    return () => {
      root.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [resetKey, total, hasMore, visibleCount, loadMore, scrollThresholdPx]);

  return {
    scrollRef,
    sentinelRef,
    visibleCount,
    hasMore,
    loadingMore,
    pageSize,
  };
}
