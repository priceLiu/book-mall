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

type PortalViewerContextValue = {
  viewerUserId: string | null;
  loading: boolean;
};

const PortalViewerContext = createContext<PortalViewerContextValue>({
  viewerUserId: null,
  loading: true,
});

export function PortalViewerProvider({ children }: { children: ReactNode }) {
  const base = useBookMallBaseUrl();
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!base?.trim()) {
      setViewerUserId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchCanvasViewerUser(base)
      .then((u) => setViewerUserId(u?.id ?? null))
      .catch(() => setViewerUserId(null))
      .finally(() => setLoading(false));
  }, [base]);

  return (
    <PortalViewerContext.Provider value={{ viewerUserId, loading }}>
      {children}
    </PortalViewerContext.Provider>
  );
}

export function usePortalViewer() {
  return useContext(PortalViewerContext);
}
