"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import type { CanvasHomeSnapshotPayload } from "@/lib/canvas-home-snapshot-types";
import {
  listCanvasTemplates,
  listPortalCaseProjects,
  listPortalFeaturedProjects,
  type CanvasTemplateRecord,
  type PortalCaseProjectSummary,
  type PortalFeaturedProjectSummary,
  type PortalFilmShowcaseMedia,
} from "@/lib/canvas-api";
import { canvasEditionFromTemplateCanvas } from "@/lib/canvas/project-edition";

const PORTAL_HOME_FETCH_TIMEOUT_MS = 25_000;
const SECONDARY_DELAY_MS = 400;

function portalHomeFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(PORTAL_HOME_FETCH_TIMEOUT_MS);
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
  featuredLoading: boolean;
  secondaryLoading: boolean;
  secondaryLoaded: boolean;
  filmShowcaseLoaded: boolean;
  loadSecondary: () => void;
};

const PortalHomeContext = createContext<PortalHomeContextValue | null>(null);

export function PortalHomeProvider({
  children,
  initialSnapshot,
}: {
  children: ReactNode;
  initialSnapshot?: CanvasHomeSnapshotPayload | null;
}) {
  const base = useBookMallBaseUrl();
  const hasStaticSnapshot = initialSnapshot != null;

  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(true);
  const [featured, setFeatured] = useState<PortalFeaturedProjectSummary[]>(
    initialSnapshot?.featured ?? [],
  );
  const [templates, setTemplates] = useState<CanvasTemplateRecord[]>(
    initialSnapshot?.templates ?? [],
  );
  const [cases, setCases] = useState<PortalCaseProjectSummary[]>(initialSnapshot?.cases ?? []);
  const [filmShowcase, setFilmShowcase] = useState<PortalFilmShowcaseMedia[]>(
    initialSnapshot?.filmShowcase ?? [],
  );
  const [featuredLoading, setFeaturedLoading] = useState(!hasStaticSnapshot);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondaryLoaded, setSecondaryLoaded] = useState(hasStaticSnapshot);
  const [filmShowcaseLoaded, setFilmShowcaseLoaded] = useState(hasStaticSnapshot);
  const secondaryStarted = useRef(hasStaticSnapshot);

  useEffect(() => {
    if (!base?.trim()) {
      setViewerUserId(null);
      setViewerLoading(false);
      return;
    }
    setViewerLoading(true);
    void fetchCanvasViewerUser(base, portalHomeFetchSignal())
      .then((u) => setViewerUserId(u?.id ?? null))
      .catch(() => setViewerUserId(null))
      .finally(() => setViewerLoading(false));
  }, [base]);

  useEffect(() => {
    if (hasStaticSnapshot || !base?.trim()) {
      if (!base?.trim()) {
        setFeatured([]);
        setFeaturedLoading(false);
      }
      return;
    }
    setFeaturedLoading(true);
    void listPortalFeaturedProjects(base, { signal: portalHomeFetchSignal() })
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setFeatured(arr.filter((p) => p.edition === "pro2"));
      })
      .catch(() => setFeatured([]))
      .finally(() => setFeaturedLoading(false));
  }, [base, hasStaticSnapshot]);

  const loadSecondary = useCallback(() => {
    if (hasStaticSnapshot || !base?.trim() || secondaryStarted.current) return;
    secondaryStarted.current = true;
    setSecondaryLoading(true);
    const signal = portalHomeFetchSignal();
    void Promise.allSettled([
      listCanvasTemplates(base, "public", signal ? { signal } : undefined),
      listPortalCaseProjects(base, "pro2", signal ? { signal } : undefined),
    ])
      .then(([tplRes, caseRes]) => {
        if (tplRes.status === "fulfilled") {
          const list = Array.isArray(tplRes.value) ? tplRes.value : [];
          setTemplates(
            list.filter(
              (t) =>
                t.edition === "pro2" ||
                canvasEditionFromTemplateCanvas(t.canvas) === "pro2",
            ),
          );
        } else {
          setTemplates([]);
        }
        if (caseRes.status === "fulfilled") {
          setCases(Array.isArray(caseRes.value) ? caseRes.value : []);
        } else {
          setCases([]);
        }
      })
      .finally(() => {
        setSecondaryLoaded(true);
        setSecondaryLoading(false);
      });
  }, [base, hasStaticSnapshot]);

  useEffect(() => {
    if (hasStaticSnapshot || !base?.trim() || secondaryLoaded) return;
    const t = window.setTimeout(() => loadSecondary(), SECONDARY_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [base, secondaryLoaded, loadSecondary, hasStaticSnapshot]);

  return (
    <PortalHomeContext.Provider
      value={{
        viewerUserId,
        viewerLoading,
        featured,
        templates,
        cases,
        filmShowcase,
        featuredLoading,
        secondaryLoading,
        secondaryLoaded,
        filmShowcaseLoaded,
        loadSecondary,
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
