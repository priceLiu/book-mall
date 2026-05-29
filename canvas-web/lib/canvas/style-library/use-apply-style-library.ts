"use client";

import { useCallback } from "react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProStyleNodeData } from "../story-pro-workspace-types";
import {
  buildStyleLibraryPresetPatch,
  resolveStyleLibraryApplyTarget,
  styleNodeHasAnchorContent,
} from "./apply-preset";
import type { StyleLibraryPreset } from "./catalog";

export function useApplyStyleLibraryPreset() {
  const dialogs = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  return useCallback(
    async (preset: StyleLibraryPreset): Promise<boolean> => {
      const selectedStyleNodeId = nodes.find(
        (n) => n.selected && n.type === "story-pro-style",
      )?.id;

      const target = resolveStyleLibraryApplyTarget(nodes, {
        selectedStyleNodeId,
      });
      if (!target.ok) {
        await dialogs.alert({
          title: target.title,
          message: target.message,
          variant: "error",
        });
        return false;
      }

      const { styleNode } = target;
      const d = styleNode.data as StoryProStyleNodeData;

      if (
        styleNodeHasAnchorContent(d) &&
        !(await dialogs.confirm({
          title: "套用风格库",
          message: `套用「${preset.name}」将替换当前锚定词与风格下拉选项，是否继续？`,
          confirmLabel: "继续套用",
          cancelLabel: "取消",
        }))
      ) {
        return false;
      }

      const patch = buildStyleLibraryPresetPatch(preset, d, {
        includeRefImage: true,
      });
      updateNodeData(styleNode.id, patch);
      return true;
    },
    [dialogs, nodes, updateNodeData],
  );
}
