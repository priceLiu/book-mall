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

function viewerFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(VIEWER_FETCH_TIMEOUT_MS);
  }
  return undefined;
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

/** 门户首页 · 发现/视频墙等读静态快照；仅 viewer-session 走实时 API */
export function PortalHomeProvider({
  children,
  snapshot,
}: {
  children: ReactNode;
  snapshot: CanvasHomeSnapshotPayload;
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
    setViewerLoading(true);
    void fetchCanvasViewerUser(base, viewerFetchSignal())
      .then((u) => setViewerUserId(u?.id ?? null))
      .catch(() => setViewerUserId(null))
      .finally(() => setViewerLoading(false));
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
