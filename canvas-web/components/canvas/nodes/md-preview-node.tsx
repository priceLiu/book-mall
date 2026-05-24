"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { FileText } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type {
  CanvasNodeRuntime,
  MdPreviewNodeData,
  StoryEngineNodeData,
  AiEngineNodeData,
} from "@/lib/canvas/types";
import { directPredecessors } from "@/lib/canvas/topo";
import { NodeShell } from "../node-shell";
import { MarkdownView } from "../markdown-view";
import { PreviewNodeHeader } from "../preview-node-header";
import { MarkdownFullscreenLightbox } from "../markdown-fullscreen-lightbox";

function resolveUpstreamMarkdown(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): string {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (
      p.type === "story-outline-engine" ||
      p.type === "character-engine" ||
      p.type === "storyboard-engine" ||
      p.type === "ai-engine"
    ) {
      const d = p.data as unknown as StoryEngineNodeData | AiEngineNodeData;
      if (d.runtime?.textOutput?.trim()) return d.runtime.textOutput.trim();
    }
    if (p.type === "text") {
      const td = p.data as { text?: string; runtime?: { textOutput?: string }; mode?: string };
      if (td.mode === "piped" && td.runtime?.textOutput?.trim()) {
        return td.runtime.textOutput.trim();
      }
      if (td.text?.trim()) return td.text.trim();
    }
  }
  return "";
}

function resolveUpstreamRuntime(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  nodeId: string,
): CanvasNodeRuntime | undefined {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (
      p.type === "story-outline-engine" ||
      p.type === "character-engine" ||
      p.type === "storyboard-engine" ||
      p.type === "ai-engine"
    ) {
      return (p.data as StoryEngineNodeData | AiEngineNodeData).runtime;
    }
  }
  return undefined;
}

/** 被动 MD 预览：展示上游 Story / AI 引擎 Markdown 输出。 */
export function MdPreviewNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as MdPreviewNodeData;
  const [fullscreen, setFullscreen] = useState(false);

  const content = useMemo(
    () => resolveUpstreamMarkdown(nodes, edges, id),
    [nodes, edges, id],
  );
  const upstreamRuntime = useMemo(
    () => resolveUpstreamRuntime(nodes, edges, id),
    [nodes, edges, id],
  );
  const title = d.label ?? "MD 预览";

  return (
    <>
      <NodeShell
        title={title}
        selected={selected}
        minWidth={320}
        minHeight={240}
        inputs={[{ id: "in_text", label: "上游 MD", kind: "text" }]}
        headerRight={
          <PreviewNodeHeader
            status={upstreamRuntime?.status ?? "idle"}
            failMessage={upstreamRuntime?.failMessage}
            previewDisabled={!content.trim()}
            onPreview={() => setFullscreen(true)}
          />
        }
        footer={
          <span className="flex items-center gap-1 text-[10px] text-[var(--canvas-muted)]">
            <FileText className="size-3" /> 只读预览 · GFM 表格
          </span>
        }
      >
        <MarkdownView content={content} className="h-full max-h-[280px]" />
      </NodeShell>

      {fullscreen ? (
        <MarkdownFullscreenLightbox
          title={title}
          content={content}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}
