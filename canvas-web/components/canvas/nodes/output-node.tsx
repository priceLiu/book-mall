"use client";

import { useEdges, useNodes, type NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { directPredecessors } from "@/lib/canvas/topo";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  ImageEngineNodeData,
  ImageNodeData,
  OutputNodeData,
} from "@/lib/canvas/types";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { NodeShell } from "../node-shell";
import { MediaHoverBox } from "../media-hover-box";

function resolveImagePreview(
  edges: CanvasFlowEdge[],
  nodes: CanvasFlowNode[],
  nodeId: string,
): string | null {
  const preds = directPredecessors(edges, nodeId);
  for (const pid of preds) {
    const n = nodes.find((x) => x.id === pid);
    if (!n) continue;
    if (n.type === "image-engine") {
      const d = n.data as unknown as ImageEngineNodeData;
      if (d.runtime?.ossUrl) return d.runtime.ossUrl;
    }
    if (n.type === "image") {
      const d = n.data as unknown as ImageNodeData;
      if (d.ossUrl) return d.ossUrl;
      if (d.blobUrl) return d.blobUrl;
    }
  }
  return null;
}

export function OutputNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as OutputNodeData;
  const nodes = useNodes() as CanvasFlowNode[];
  const edges = useEdges();
  const preview = resolveImagePreview(edges, nodes, id);

  return (
    <NodeShell
      title="输出"
      subtitle={d.title ?? "未命名画作"}
      selected={selected}
      runtime={d.runtime}
      minWidth={260}
      minHeight={260}
      inputs={[{ id: "in_image", label: "最终画面", kind: "image" }]}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="min-h-[140px] flex-1 overflow-hidden rounded-lg border border-white/10 bg-black">
          <MediaHoverBox
            src={preview ?? undefined}
            variant="generated"
            alt="output"
            placeholder={
              <div className="flex h-full items-center justify-center text-[var(--canvas-muted)]">
                <ImageIcon className="size-6 opacity-40" />
              </div>
            }
          />
        </div>

        <input
          type="text"
          value={d.title ?? ""}
          onChange={(e) => updateNodeData(id, { title: e.target.value })}
          placeholder="作品标题"
          className={`${RF_NODE_SCROLL} w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
        />
        <label className="flex items-center gap-2 text-[11px] text-[var(--canvas-muted)]">
          <input
            type="checkbox"
            checked={d.saveToGallery !== false}
            onChange={(e) => updateNodeData(id, { saveToGallery: e.target.checked })}
          />
          保存到画作库
        </label>
      </div>
    </NodeShell>
  );
}
