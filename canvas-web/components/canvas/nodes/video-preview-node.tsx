"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Download, Maximize2, Video } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { VideoEngineNodeData, VideoPreviewNodeData } from "@/lib/canvas/types";
import { directPredecessors } from "@/lib/canvas/topo";
import { NodeShell } from "../node-shell";
import { CanvasVideoPlayer } from "../canvas-video-player";
import { MediaPreviewLightbox } from "../media-hover-box";
import { PreviewNodeHeader } from "../preview-node-header";
import { SaveVideoToLibraryButton } from "../save-video-to-library-button";
import {
  NODE_BTN_GHOST,
  NODE_MEDIA_MIN_WIDTH,
  NODE_MEDIA_PREVIEW_HEIGHT,
  NodeMediaStage,
} from "../node-ui";

export function resolveUpstreamVideoUrl(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): string | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (p?.type === "video-engine") {
      const d = p.data as unknown as VideoEngineNodeData;
      return d.runtime?.ossUrl ?? d.runtime?.ephemeralUrl;
    }
  }
  return undefined;
}

/** 分镜视频只读预览：上游接 video-engine，支持节点内播放 + 全屏。 */
export function VideoPreviewNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as VideoPreviewNodeData;
  const [fullscreen, setFullscreen] = useState(false);

  const url = useMemo(
    () => resolveUpstreamVideoUrl(nodes, edges, id),
    [nodes, edges, id],
  );

  const upstreamEngine = useMemo(() => {
    for (const pid of directPredecessors(edges, id)) {
      const p = nodes.find((n) => n.id === pid);
      if (p?.type === "video-engine") {
        return p;
      }
    }
    return undefined;
  }, [nodes, edges, id]);

  const upstreamRuntime = (
    upstreamEngine?.data as VideoEngineNodeData | undefined
  )?.runtime;

  const upstreamData = upstreamEngine?.data as VideoEngineNodeData | undefined;

  const title = d.label ?? (d.frameIndex ? `视频 · 镜${d.frameIndex}` : "视频预览");

  return (
    <>
      <NodeShell
        title={title}
        selected={selected}
        minWidth={NODE_MEDIA_MIN_WIDTH}
        minHeight={NODE_MEDIA_PREVIEW_HEIGHT}
        inputs={[{ id: "in_video", label: "分镜视频", kind: "image" }]}
        headerRight={
          <PreviewNodeHeader
            status={upstreamRuntime?.status ?? "idle"}
            failMessage={upstreamRuntime?.failMessage}
            previewDisabled={!url}
            onPreview={() => setFullscreen(true)}
          />
        }
        footer={
          <span className="flex items-center gap-1 text-[10px] text-[var(--canvas-muted)]">
            <Video className="size-3" /> 分镜视频预览 · 可播放
          </span>
        }
      >
        {url ? (
          <div className="flex flex-col gap-2">
            <NodeMediaStage>
              <CanvasVideoPlayer
                key={url}
                src={url}
                className="h-full w-full rounded-none border-0"
              />
            </NodeMediaStage>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={NODE_BTN_GHOST}
                onClick={() => setFullscreen(true)}
              >
                <Maximize2 className="size-3" /> 全屏播放
              </button>
              <SaveVideoToLibraryButton
                variant="inline"
                videoUrl={url}
                saveInput={{
                  mode: "i2v",
                  prompt: upstreamData?.prompt,
                  modelLabel: upstreamData?.modelKey,
                }}
              />
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
            {upstreamRuntime?.status === "running" ||
            upstreamRuntime?.status === "pending"
              ? "视频生成中…"
              : "连接上游 video-engine 并生成后在此播放"}
          </p>
        )}
      </NodeShell>

      {fullscreen && url ? (
        <MediaPreviewLightbox
          src={url}
          kind="video"
          alt={d.label ?? "分镜视频"}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}
