"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Volume2 } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { AudioPreviewNodeData, TtsEngineNodeData } from "@/lib/canvas/types";
import { directPredecessors } from "@/lib/canvas/topo";
import { NodeShell } from "../node-shell";
import { PreviewNodeHeader } from "../preview-node-header";
import { AudioFullscreenLightbox } from "../audio-fullscreen-lightbox";

function resolveAudioUrl(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): string | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (p?.type === "tts-engine") {
      const d = p.data as unknown as TtsEngineNodeData;
      return d.runtime?.ossUrl;
    }
  }
  return undefined;
}

function resolveUpstreamRuntime(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
) {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (p?.type === "tts-engine") {
      return (p.data as unknown as TtsEngineNodeData).runtime;
    }
  }
  return undefined;
}

export function AudioPreviewNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as AudioPreviewNodeData;
  const [fullscreen, setFullscreen] = useState(false);

  const url = useMemo(
    () => resolveAudioUrl(nodes, edges, id),
    [nodes, edges, id],
  );
  const upstreamRuntime = useMemo(
    () => resolveUpstreamRuntime(nodes, edges, id),
    [nodes, edges, id],
  );
  const title = d.label ?? (d.frameIndex ? `音频 · 镜${d.frameIndex}` : "音频预览");

  return (
    <>
      <NodeShell
        title={title}
        selected={selected}
        minWidth={280}
        minHeight={160}
        inputs={[{ id: "in_text", label: "TTS", kind: "text" }]}
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
            <Volume2 className="size-3" /> 只读预览
          </span>
        }
      >
        {url ? (
          <audio src={url} controls className="w-full" />
        ) : (
          <p className="text-[11px] text-[var(--canvas-muted)]">
            {upstreamRuntime?.status === "running" ||
            upstreamRuntime?.status === "pending"
              ? "配音生成中…"
              : "连接上游 tts-engine 并生成后显示"}
          </p>
        )}
      </NodeShell>

      {fullscreen && url ? (
        <AudioFullscreenLightbox
          title={title}
          src={url}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}
