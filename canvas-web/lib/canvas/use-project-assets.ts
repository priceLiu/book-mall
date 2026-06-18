"use client";

import { useCallback, useEffect, useState } from "react";
import { listProjectAssets, type ProjectAssetKind, type ProjectAssetRecord } from "@/lib/canvas-api";

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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAssets([]);
    try {
      const rows = await listProjectAssets(base, {
        projectId: opts?.projectId,
        kind: opts?.kind ?? undefined,
        scope: opts?.scope ?? "all",
      });
      setAssets(rows);
    } catch (e) {
      setAssets([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [base, opts?.projectId, opts?.kind, opts?.scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [refresh]);

  return { assets, loading, error, refresh };
}
