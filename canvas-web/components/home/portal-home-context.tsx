"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import type { CanvasHomeSnapshotPayload } from "@/lib/canvas-home-snapshot-types";
import type {
  CanvasTemplateRecord,
  PortalCaseProjectSummary,
  PortalFeaturedProjectSummary,
  PortalFilmShowcaseMedia,
} from "@/lib/canvas-api";

const VIEWER_FETCH_TIMEOUT_MS = 25_000;
const VIEWER_DEFER_MS = 500;

export type CanvasHomeSnapshotMeta = {
  dateKey: string;
  source: "snapshot" | "fallback";
  stale: boolean;
};

function viewerFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(VIEWER_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

function scheduleDeferredViewerFetch(run: () => void): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(run, { timeout: VIEWER_DEFER_MS });
    return () => cancelIdleCallback(id);
  }
  const t = window.setTimeout(run, VIEWER_DEFER_MS);
  return () => window.clearTimeout(t);
}

type PortalHomeContextValue = {
  viewerUserId: string | null;
  viewerLoading: boolean;
  featured: PortalFeaturedProjectSummary[];
  templates: CanvasTemplateRecord[];
  cases: PortalCaseProjectSummary[];
  filmShowcase: PortalFilmShowcaseMedia[];
};

const PortalHomeContext = createContext<PortalHomeContextValue | null>(null);

/** 门户首页 · SSR 快照直出发现/视频墙；viewer-session 延迟拉取 */
export function PortalHomeProvider({
  children,
  snapshot,
}: {
  children: ReactNode;
  snapshot: CanvasHomeSnapshotPayload;
  /** 稳定元数据，供后续扩展；不参与 portal 内容 reset */
  snapshotMeta?: CanvasHomeSnapshotMeta;
}) {
  const base = useBookMallBaseUrl();
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(true);

  useEffect(() => {
    if (!base?.trim()) {
      setViewerUserId(null);
      setViewerLoading(false);
      return;
    }
    let cancelled = false;
    const cancelSchedule = scheduleDeferredViewerFetch(() => {
      if (cancelled) return;
      setViewerLoading(true);
      void fetchCanvasViewerUser(base, viewerFetchSignal())
        .then((u) => {
          if (!cancelled) setViewerUserId(u?.id ?? null);
        })
        .catch(() => {
          if (!cancelled) setViewerUserId(null);
        })
        .finally(() => {
          if (!cancelled) setViewerLoading(false);
        });
    });
    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, [base]);

  return (
    <PortalHomeContext.Provider
      value={{
        viewerUserId,
        viewerLoading,
        featured: snapshot.featured,
        templates: snapshot.templates,
        cases: snapshot.cases,
        filmShowcase: snapshot.filmShowcase,
      }}
    >
      {children}
    </PortalHomeContext.Provider>
  );
}

export function usePortalHome() {
  const ctx = useContext(PortalHomeContext);
  if (!ctx) {
    throw new Error("usePortalHome must be used within PortalHomeProvider");
  }
  return ctx;
}

/** @deprecated 兼容旧名 */
export const PortalViewerProvider = PortalHomeProvider;

/** @deprecated 兼容旧名 */
export function usePortalViewer() {
  const { viewerUserId, viewerLoading } = usePortalHome();
  return { viewerUserId, loading: viewerLoading };
}
