"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listProjectAssets,
  type ProjectAssetKind,
  type ProjectAssetRecord,
} from "@/lib/canvas-api";
import { CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE } from "@/lib/canvas/canvas-toolbar-side-panel";

const CHANGE_EVENT = "canvas:project-assets-changed";

export function notifyProjectAssetsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function useProjectAssets(
  base: string,
  opts?: {
    projectId?: string | null;
    kind?: ProjectAssetKind | null;
    scope?: "all" | "project" | "library";
  },
) {
  const [assets, setAssets] = useState<ProjectAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      if (!base) {
        return { assets: [], hasMore: false, nextCursor: null };
      }
      return listProjectAssets(base, {
        projectId: opts?.projectId,
        kind: opts?.kind ?? undefined,
        scope: opts?.scope ?? "all",
        limit: CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
        cursor,
      });
    },
    [base, opts?.projectId, opts?.kind, opts?.scope],
  );

  const refresh = useCallback(async () => {
    if (!base) {
      setAssets([]);
      setLoading(false);
      setHasMore(false);
      cursorRef.current = null;
      hasMoreRef.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(null);
      setAssets(page.assets);
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
      cursorRef.current = page.nextCursor;
    } catch (e) {
      setAssets([]);
      setHasMore(false);
      hasMoreRef.current = false;
      cursorRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [base, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!base || !hasMoreRef.current || !cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursorRef.current);
      setAssets((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const merged = [...prev];
        for (const row of page.assets) {
          if (!seen.has(row.id)) merged.push(row);
        }
        return merged;
      });
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
      cursorRef.current = page.nextCursor;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [base, fetchPage, loadingMore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [refresh]);

  return {
    assets,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    refresh,
  };
}
