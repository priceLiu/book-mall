"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Download, ImageIcon, Maximize2 } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type {
  ImageEngineNodeData,
  ImageNodeData,
  ImagePreviewNodeData,
  ThreeViewEngineNodeData,
  CanvasNodeRuntime,
  CanvasNodeRunStatus,
} from "@/lib/canvas/types";
import { pickRuntimeImagePreviewUrl, pickTaskImagePreviewUrl } from "@/lib/canvas/task-media-url";
import { directPredecessors } from "@/lib/canvas/topo";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { NodeShell } from "../node-shell";
import { MediaHoverBox, MediaPreviewLightbox } from "../media-hover-box";
import { PreviewNodeHeader } from "../preview-node-header";
import {
  NODE_BTN_GHOST,
  NODE_MEDIA_MIN_WIDTH,
  NODE_MEDIA_PREVIEW_HEIGHT,
  NodeMediaStage,
} from "../node-ui";

export function resolveUpstreamImageUrl(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
  taskFallback?: { ossUrl: string | null; ephemeralUrl: string | null; model: string },
): string | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "three-view-engine" || p.type === "image-engine") {
      const d = p.data as unknown as ThreeViewEngineNodeData | ImageEngineNodeData;
      const fromRuntime =
        pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
        d.runtime?.ossUrl ??
        d.runtime?.ephemeralUrl;
      if (fromRuntime) return fromRuntime;
      if (taskFallback) {
        return pickTaskImagePreviewUrl(taskFallback) ?? undefined;
      }
    }
    if (p.type === "image") {
      const d = p.data as unknown as ImageNodeData;
      return d.ossUrl ?? d.blobUrl;
    }
  }
  return undefined;
}

function upstreamRuntime(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): CanvasNodeRuntime | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (p?.type === "three-view-engine" || p?.type === "image-engine") {
      return (
        p.data as ThreeViewEngineNodeData | ImageEngineNodeData
      ).runtime;
    }
  }
  return undefined;
}

/** 三视图 / 分镜图只读预览：上游接 three-view-engine 或 image-engine。 */
export function ImagePreviewNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as ImagePreviewNodeData;
  const [fullscreen, setFullscreen] = useState(false);

  const upstreamEngineId = useMemo(() => {
    for (const pid of directPredecessors(edges, id)) {
      const p = nodes.find((n) => n.id === pid);
      if (p?.type === "three-view-engine" || p?.type === "image-engine") {
        return pid;
      }
    }
    return null;
  }, [nodes, edges, id]);

  const { succeeded } = useNodeTaskHistory(upstreamEngineId);
  const latestTask = succeeded[succeeded.length - 1];

  const url = useMemo(
    () =>
      resolveUpstreamImageUrl(nodes, edges, id, latestTask) ??
      (latestTask ? pickTaskImagePreviewUrl(latestTask) : undefined),
    [nodes, edges, id, latestTask],
  );
  const upstream = useMemo(
    () => upstreamRuntime(nodes, edges, id),
    [nodes, edges, id],
  );
  const generating =
    upstream?.status === "running" || upstream?.status === "pending";

  const title =
    d.label ??
    (d.characterName
      ? `三视图 · ${d.characterName}`
      : d.frameIndex
        ? `分镜图 · 镜${d.frameIndex}`
        : "图片预览");

  return (
    <>
      <NodeShell
        title={title}
        selected={selected}
        minWidth={NODE_MEDIA_MIN_WIDTH}
        minHeight={NODE_MEDIA_PREVIEW_HEIGHT}
        inputs={[{ id: "in_image", label: "上游图片", kind: "image" }]}
        headerRight={
          <PreviewNodeHeader
            status={(upstream?.status ?? "idle") as CanvasNodeRunStatus}
            failMessage={upstream?.failMessage}
            previewDisabled={!url}
            onPreview={() => setFullscreen(true)}
          />
        }
        footer={
          <span className="flex items-center gap-1 text-[10px] text-[var(--canvas-muted)]">
            <ImageIcon className="size-3" /> 只读预览 · 可放大
          </span>
        }
      >
        {url ? (
          <div className="flex flex-col gap-2">
            <NodeMediaStage>
              <MediaHoverBox
                src={url}
                mediaKind="image"
                variant="generated"
                alt={title}
                fit="contain"
                clickToPreview
              />
            </NodeMediaStage>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={NODE_BTN_GHOST}
                onClick={() => setFullscreen(true)}
              >
                <Maximize2 className="size-3" /> 大图预览
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${NODE_BTN_GHOST} ml-auto`}
              >
                <Download className="size-3" /> 下载
              </a>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--canvas-muted)]">
            {generating
              ? "三视图生成中…"
              : "连接上游 three-view-engine 并生成后显示"}
          </p>
        )}
      </NodeShell>

      {fullscreen && url ? (
        <MediaPreviewLightbox
          src={url}
          kind="image"
          alt={title}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}
