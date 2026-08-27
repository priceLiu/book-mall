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
import { hydrateCanvasHomeSnapshotClient } from "@/lib/canvas-home-snapshot.client";
import type { CanvasHomeSnapshotPayload } from "@/lib/canvas-home-snapshot-types";
import { isCanvasHomeSnapshotEmpty } from "@/lib/canvas-home-snapshot-types";
import type {
  CanvasTemplateRecord,
  PortalCaseProjectSummary,
  PortalFeaturedProjectSummary,
  PortalFilmShowcaseMedia,
} from "@/lib/canvas-api";

const VIEWER_FETCH_TIMEOUT_MS = 25_000;
const PORTAL_HYDRATE_TIMEOUT_MS = 30_000;

function viewerFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(VIEWER_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

function portalHydrateSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(PORTAL_HYDRATE_TIMEOUT_MS);
  }
  return undefined;
}

type PortalHomeContextValue = {
  viewerUserId: string | null;
  viewerLoading: boolean;
  portalContentLoading: boolean;
  featured: PortalFeaturedProjectSummary[];
  templates: CanvasTemplateRecord[];
  cases: PortalCaseProjectSummary[];
  filmShowcase: PortalFilmShowcaseMedia[];
};

const PortalHomeContext = createContext<PortalHomeContextValue | null>(null);

/** 门户首页 · SSR 快照 + 客户端兜底；viewer-session 走实时 API */
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
  const [portalPayload, setPortalPayload] =
    useState<CanvasHomeSnapshotPayload>(snapshot);
  const [portalContentLoading, setPortalContentLoading] = useState(() =>
    isCanvasHomeSnapshotEmpty(snapshot),
  );

  useEffect(() => {
    setPortalPayload(snapshot);
    setPortalContentLoading(isCanvasHomeSnapshotEmpty(snapshot));
  }, [snapshot]);

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

  useEffect(() => {
    if (!base?.trim() || !isCanvasHomeSnapshotEmpty(snapshot)) return;
    let cancelled = false;
    setPortalContentLoading(true);
    void hydrateCanvasHomeSnapshotClient(
      base,
      snapshot,
      portalHydrateSignal(),
    )
      .then((next) => {
        if (!cancelled) setPortalPayload(next);
      })
      .finally(() => {
        if (!cancelled) setPortalContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base, snapshot]);

  return (
    <PortalHomeContext.Provider
      value={{
        viewerUserId,
        viewerLoading,
        portalContentLoading,
        featured: portalPayload.featured,
        templates: portalPayload.templates,
        cases: portalPayload.cases,
        filmShowcase: portalPayload.filmShowcase,
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
