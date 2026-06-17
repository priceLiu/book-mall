"use client";

import { useCallback, useMemo } from "react";
import { useNodes } from "@xyflow/react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { buildSbv1DockMentionables } from "@/lib/canvas/sbv1-dock-mentionables";
import { resolveSbv1UpstreamRefLinks } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import { libtvFloatingDockHidden } from "@/lib/canvas/use-viewport-transform-active";
import { Sbv1VideoEngineChatInput } from "./sbv1-video-engine-chat-input";
import { useSbv1DockPlacement } from "./use-sbv1-dock-placement";

/** 分镜视频 1.0 · 视频引擎浮动输入坞（选中节点时显示在节点下方） */
export function Sbv1VideoEngineFloatingDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const dockHidden = useCanvasStore((s) =>
    libtvFloatingDockHidden(s.canvasGeometryDragging, s.canvasViewportMoving),
  );

  const selectedEngine = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "sbv1-video-engine",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedEngine) return null;
    return nodes.find((n) => n.id === selectedEngine.id) ?? null;
  }, [selectedEngine, nodes]);

  const placement = useSbv1DockPlacement(selectedEngine?.id ?? null);

  const nodeId = storeNode?.id ?? "";
  const d = (storeNode?.data ?? {}) as Sbv1VideoEngineNodeData;
  const upstreamLinks = useMemo(
    () => (nodeId ? resolveSbv1UpstreamRefLinks(nodeId, nodes, edges) : []),
    [nodeId, nodes, edges],
  );
  const mentionables = useMemo(
    () => buildSbv1DockMentionables(upstreamLinks),
    [upstreamLinks],
  );

  const isGenerating =
    d.runtime?.status === "pending" || d.runtime?.status === "running";

  const onPatch = useCallback(
    (patch: Partial<Sbv1VideoEngineNodeData>) => {
      if (!nodeId) return;
      updateNodeData(nodeId, patch);
    },
    [nodeId, updateNodeData],
  );

  const onRun = useCallback(async () => {
    const prompt = (d.prompt ?? "").trim();
    const hasRefs = upstreamLinks.some((l) => l.previewUrl);
    if (!prompt && !hasRefs) {
      await alert({
        title: "无法生成",
        message: "请填写 prompt 或连接/上传至少一张参考图。",
        variant: "warning",
      });
      return;
    }
    if (d.referenceMode === "first_last" && upstreamLinks.length < 1) {
      await alert({
        title: "首尾帧模式",
        message: "请至少连接首帧参考图。",
        variant: "warning",
      });
      return;
    }
    if (!d.engine?.providerId?.trim() || !d.engine?.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "请选择火山 Seedance 模型后再生成。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    busEnqueueStoryRun({ nodeId, forceFresh: true });
  }, [d, upstreamLinks, base, alert, nodeId]);

  if (!storeNode || !placement) return null;

  return (
    <Sbv1VideoEngineChatInput
      nodeId={nodeId}
      data={d}
      upstreamLinks={upstreamLinks}
      mentionables={mentionables}
      isGenerating={isGenerating}
      onPatch={onPatch}
      onRun={onRun}
      placement={placement}
      hidden={dockHidden}
    />
  );
}
