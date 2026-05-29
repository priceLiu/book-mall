"use client";

import { useCallback } from "react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProStyleNodeData } from "../story-pro-workspace-types";
import {
  buildStyleLibraryPresetPatch,
  styleNodeFieldsLocked,
  styleNodeHasAnchorContent,
} from "./apply-preset";
import type { StyleLibraryPreset } from "./catalog";

export function useApplyStyleLibraryPreset() {
  const dialogs = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  return useCallback(
    async (preset: StyleLibraryPreset): Promise<boolean> => {
      const styleNode = nodes.find((n) => n.type === "story-pro-style");
      if (!styleNode) {
        await dialogs.alert({
          title: "未找到风格节点",
          message:
            "当前画布没有「风格定义」节点。请先使用影视专业版工作流模板。",
          variant: "error",
        });
        return false;
      }

      const d = styleNode.data as StoryProStyleNodeData;
      const hubId = d.hubNodeId;
      const hub = hubId
        ? nodes.find((n) => n.id === hubId && n.type === "story-pro-script-hub")
        : null;
      const hubData = (hub?.data ?? {}) as { scriptFinalized?: boolean };
      if (!hubData.scriptFinalized) {
        await dialogs.alert({
          title: "请先故事定稿",
          message:
            "请先在「故事剧本」节点完成大纲并点击「故事定稿」，再套用风格库。",
          variant: "error",
        });
        return false;
      }

      const lock = styleNodeFieldsLocked(d);
      if (lock.locked) {
        await dialogs.alert({
          title: "无法套用",
          message: lock.reason ?? "风格节点当前不可编辑。",
          variant: "error",
        });
        return false;
      }

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
