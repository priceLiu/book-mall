"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Video } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { AiVideoEngineNodeData, VideoGenerateNodeData } from "@/lib/canvas/types";
import { directPredecessors } from "@/lib/canvas/topo";
import { REF_VIDEO_NODE_SIZE } from "@/lib/canvas/ref-video-models";
import { NodeShell } from "../node-shell";
import { CanvasVideoPreviewSlot } from "../canvas-video-preview-slot";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { PreviewNodeHeader } from "../preview-node-header";

export function resolveUpstreamRefVideoUrl(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): string | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (p?.type === "ai-video-engine") {
      const d = p.data as unknown as AiVideoEngineNodeData;
      return d.runtime?.ossUrl ?? d.runtime?.ephemeralUrl;
    }
  }
  return undefined;
}

/** 参考生视频 · 成片只读节点 */
export function VideoGenerateNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as VideoGenerateNodeData;
  const [previewOpen, setPreviewOpen] = useState(false);

  const url = useMemo(
    () => resolveUpstreamRefVideoUrl(nodes, edges, id),
    [nodes, edges, id],
  );

  const upstreamRuntime = useMemo(() => {
    for (const pid of directPredecessors(edges, id)) {
      const p = nodes.find((n) => n.id === pid);
      if (p?.type === "ai-video-engine") {
        return (p.data as AiVideoEngineNodeData).runtime;
      }
    }
    return undefined;
  }, [nodes, edges, id]);

  const title = d.label ?? "视频生成";
  const generating =
    upstreamRuntime?.status === "running" ||
    upstreamRuntime?.status === "pending";

  const openPreview = () => {
    if (url) setPreviewOpen(true);
  };

  return (
    <>
      <NodeShell
        title={title}
        selected={selected}
        minWidth={REF_VIDEO_NODE_SIZE.width}
        minHeight={REF_VIDEO_NODE_SIZE.height}
        inputs={[{ id: "in_video", label: "视频", kind: "image" }]}
        headerRight={
          <PreviewNodeHeader
            status={upstreamRuntime?.status ?? "idle"}
            failMessage={upstreamRuntime?.failMessage}
            previewDisabled={!url}
            onPreview={openPreview}
          />
        }
        footer={
          <span className="flex items-center gap-1 text-[10px] text-[var(--canvas-muted)]">
            <Video className="size-3" /> 上游 AI 视频引擎输出
          </span>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <CanvasVideoPreviewSlot
            className="min-h-0 flex-1"
            videoUrl={url}
            generating={generating && !url}
            onPreview={url ? openPreview : undefined}
            emptyIcon={<Video className="size-24" strokeWidth={1.25} />}
            emptyMessage="连接 AI 视频引擎后生成"
          />
        </div>
      </NodeShell>

      {previewOpen && url ? (
        <StoryMediaPreviewModal
          url={url}
          kind="video"
          title={title}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
