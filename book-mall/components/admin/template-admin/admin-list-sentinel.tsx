"use client";

import { useEffect, useRef } from "react";

/** 滚动到列表底部附近时触发加载下一页 */
export function AdminListSentinel({
  hasMore,
  loading,
  onVisible,
}: {
  hasMore: boolean;
  loading: boolean;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onVisibleRef.current();
      },
      { root: null, rootMargin: "280px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex h-10 items-center justify-center text-[11px] text-[#656d76]">
      {loading ? "加载更多…" : ""}
    </div>
  );
}
