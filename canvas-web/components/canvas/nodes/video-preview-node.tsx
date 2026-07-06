"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { Download, Maximize2, Video } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type {
  JianyingExportNodeData,
  VideoEngineNodeData,
  VideoPreviewNodeData,
} from "@/lib/canvas/types";
import { directPredecessors } from "@/lib/canvas/topo";
import { probeLibtvMediaNaturalSize } from "@/lib/canvas/libtv-media-node-auto-fit";
import { LIBTV_CARD_DRAG_CLASS } from "@/lib/canvas/libtv-node-chrome";
import { NodeShell } from "../node-shell";
import { CanvasVideoPlayer } from "../canvas-video-player";
import { MediaPreviewLightbox } from "../media-hover-box";
import { PreviewNodeHeader } from "../preview-node-header";
import { SaveVideoToLibraryButton } from "../save-video-to-library-button";
import { PRO2_NODE_HANDLE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import {
  NODE_BTN_GHOST,
  NODE_MEDIA_MIN_WIDTH,
  NODE_MEDIA_PREVIEW_HEIGHT,
  NodeMediaStage,
} from "../node-ui";

/** 与导出剪辑节点一致的底色 */
const CLIP_PREVIEW_BG = "#000000";

const CLIP_PREVIEW_MAX_LONG_EDGE = 420;
const CLIP_PREVIEW_MIN_WIDTH = 260;
const CLIP_PREVIEW_MIN_HEIGHT = 146;

function computeClipPreviewNodeSize(naturalWidth: number, naturalHeight: number) {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const ratio = nw / nh;
  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = CLIP_PREVIEW_MAX_LONG_EDGE;
    height = Math.ceil(CLIP_PREVIEW_MAX_LONG_EDGE / ratio);
  } else {
    height = CLIP_PREVIEW_MAX_LONG_EDGE;
    width = Math.ceil(CLIP_PREVIEW_MAX_LONG_EDGE * ratio);
  }
  return {
    width: Math.max(CLIP_PREVIEW_MIN_WIDTH, width),
    height: Math.max(CLIP_PREVIEW_MIN_HEIGHT, height),
  };
}

export function resolveUpstreamVideoUrl(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): string | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (
      p.type === "jianying-export-pro2" ||
      p.type === "jianying-export" ||
      p.type === "jianying-export-pro"
    ) {
      const url = (p.data as JianyingExportNodeData).mediaRenderResult?.downloadUrl;
      if (url?.trim()) return url.trim();
      continue;
    }
    if (p.type === "video-engine" || p.type === "sbv1-video-engine") {
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
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as VideoPreviewNodeData;
  const [fullscreen, setFullscreen] = useState(false);

  const url = useMemo(() => {
    const direct = d.videoUrl?.trim();
    if (direct) return direct;
    return resolveUpstreamVideoUrl(nodes, edges, id);
  }, [d.videoUrl, nodes, edges, id]);

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

  const isClipRender = Boolean(d.videoUrl?.trim());
  const title = d.label ?? (d.frameIndex ? `视频 · 镜${d.frameIndex}` : "视频预览");

  useEffect(() => {
    if (!isClipRender || !url) return;
    if (d.mediaFit && d.mediaFitKey === url) return;

    let cancelled = false;
    void probeLibtvMediaNaturalSize(url, "video")
      .then(({ w, h }) => {
        if (cancelled) return;
        resizeNode(id, computeClipPreviewNodeSize(w, h));
        updateNodeData(id, { mediaFit: true, mediaFitKey: url });
      })
      .catch(() => {
        /* 保留当前尺寸 */
      });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    isClipRender,
    url,
    d.mediaFit,
    d.mediaFitKey,
    resizeNode,
    updateNodeData,
  ]);

  // 剪辑成片：纯播放器 · 无边框 · 节点随成片比例自适应 · 空白区全域拖动（控件 nodrag）
  if (isClipRender) {
    return (
      <>
        <div
          className={cn(
            LIBTV_CARD_DRAG_CLASS,
            "group relative h-full w-full min-h-0 overflow-hidden",
          )}
          style={{ backgroundColor: CLIP_PREVIEW_BG }}
        >
          <NodeResizer
            isVisible={!!selected}
            minWidth={CLIP_PREVIEW_MIN_WIDTH}
            minHeight={CLIP_PREVIEW_MIN_HEIGHT}
          />
          <Handle
            id="in_video"
            type="target"
            position={Position.Left}
            className={cn(
              PRO2_NODE_HANDLE_CLASS,
              selected ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            title="剪辑成片"
          />

          {url ? (
            <>
              <CanvasVideoPlayer
                key={url}
                src={url}
                fill
                objectFit="contain"
                className={cn(RF_NO_DRAG, "absolute inset-0 h-full w-full border-0 bg-black")}
              />
              <button
                type="button"
                className={cn(
                  RF_NO_DRAG,
                  "absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-md bg-black/55 text-white/80 opacity-0 backdrop-blur-sm transition hover:bg-black/75 hover:text-white group-hover:opacity-100",
                )}
                onClick={() => setFullscreen(true)}
                title="全屏预览"
              >
                <Maximize2 className="size-4" />
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-white/40">
              成片生成后在此播放
            </div>
          )}
        </div>

        {fullscreen && url ? (
          <MediaPreviewLightbox
            src={url}
            kind="video"
            alt={title}
            onClose={() => setFullscreen(false)}
          />
        ) : null}
      </>
    );
  }

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
            <Video className="size-3" />{" "}
            {d.videoUrl ? "剪辑成片 · 可播放" : "分镜视频预览 · 可播放"}
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
