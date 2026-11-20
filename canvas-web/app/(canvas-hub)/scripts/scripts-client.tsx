"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";
import {
  CREW_COLLABORATION_PERSONAL_HINT,
} from "@/lib/canvas/crew-collaboration-access";
import { useCrewCollaborationAccess } from "@/lib/canvas/use-crew-collaboration-access";
import {
  listScriptPackageAssetPage,
  SCRIPT_PACKAGE_TAB_PAGE_SIZE,
} from "@/lib/canvas/list-pickable-script-packages";
import type { NewProjectScriptPackageAsset } from "@/lib/canvas/pro2-new-project-script-package";
import { usePanelInfiniteScroll } from "@/lib/canvas/use-panel-infinite-scroll";

export function ScriptsClient() {
  const base = useBookMallBaseUrl();
  const collaboration = useCrewCollaborationAccess();
  const [scripts, setScripts] = useState<NewProjectScriptPackageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      if (!base) {
        return { items: [], hasMore: false, nextCursor: null };
      }
      return listScriptPackageAssetPage(base, {
        cursor,
        limit: SCRIPT_PACKAGE_TAB_PAGE_SIZE,
      });
    },
    [base],
  );

  const refresh = useCallback(async () => {
    if (!base) {
      setScripts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const page = await fetchPage(null);
      setScripts(page.items);
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
      cursorRef.current = page.nextCursor;
      setError(null);
    } catch (e) {
      setScripts([]);
      setHasMore(false);
      hasMoreRef.current = false;
      cursorRef.current = null;
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!base || !hasMoreRef.current || !cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursorRef.current);
      setScripts((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const merged = [...prev];
        for (const row of page.items) {
          if (!seen.has(row.id)) merged.push(row);
        }
        return merged;
      });
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
      cursorRef.current = page.nextCursor;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingMore(false);
    }
  }, [base, fetchPage, loadingMore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMoreSentinelRef = usePanelInfiniteScroll({
    enabled: !loading,
    hasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
    rootMargin: "480px",
  });

  return (
    <>
      {!collaboration.canUseCrewBulletin ? (
        <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-950/20 px-4 py-2 text-[12px] text-amber-100/90">
          {CREW_COLLABORATION_PERSONAL_HINT}
        </p>
      ) : null}

      <div className="mb-6 flex justify-end">
        <Link href="/projects" className="twenty-btn-accent shrink-0 text-sm">
          <Plus className="mr-2 size-4" />
          新建关联画布
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading && scripts.length === 0 ? (
        <CanvasListSkeleton sections={1} cardsPerSection={9} />
      ) : scripts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有已发布剧本。在影视专业版 2.0 剧本创作画布中定稿并发布剧本包后，会出现在这里。
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scripts.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4"
              >
                <p className="font-medium text-white">{s.displayName}</p>
                <p className="mt-1 text-[11px] text-[var(--canvas-muted)]">
                  ID · {s.id.slice(0, 12)}…
                </p>
                <Link
                  href="/projects"
                  className="mt-3 inline-block text-sm text-[var(--canvas-accent)] hover:underline"
                >
                  用此剧本新建画布 →
                </Link>
              </li>
            ))}
          </ul>
          {loadingMore ? (
            <p className="py-3 text-center text-[11px] text-white/45">加载更多…</p>
          ) : hasMore ? (
            <p className="py-3 text-center text-[11px] text-white/35">
              向下滚动自动加载下一页
            </p>
          ) : null}
          <div ref={loadMoreSentinelRef} className="h-8" aria-hidden />
        </>
      )}
    </>
  );
}