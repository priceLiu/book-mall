"use client";

import { useMemo } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import type { ProjectAssetRecord } from "./project-asset-types";
import { useCanvasStore } from "./store";
import { useProjectAssets } from "./use-project-assets";

/** Dock @ 列表 · 本人可见的项目资产（含本项目 + 跨项目「我的」+ 团队） */
export function useDockLibraryAssets(): ProjectAssetRecord[] {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const { assets } = useProjectAssets(base, {
    projectId: projectId ?? undefined,
    scope: "all",
  });
  return useMemo(
    () =>
      assets.filter(
        (a) =>
          !a.id.startsWith("legacy:") &&
          Boolean(a.thumbnailUrl || a.refs.some((r) => r.mediaUrl?.trim())),
      ),
    [assets],
  );
}
