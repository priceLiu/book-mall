"use client";

import { useCallback } from "react";
import { openSaveProjectAssetDialog } from "@/components/canvas/save-project-asset-dialog";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  exportStoryProColumnToDraft,
  type StoryProColumnRowSnapshot,
} from "./story-pro-column-asset-export";

export function useSaveStoryProColumnAsAsset(
  nodeId: string,
  nodeType: "story-pro-character" | "story-pro-frame" | "story-pro-video",
) {
  const projectId = useCanvasStore((s) => s.projectId) ?? "";

  return useCallback(
    (rows: StoryProColumnRowSnapshot[]) => {
      if (!projectId || !rows.length) return;
      openSaveProjectAssetDialog(
        exportStoryProColumnToDraft({
          projectId,
          nodeId,
          nodeType,
          rows,
        }),
      );
    },
    [nodeId, nodeType, projectId],
  );
}
