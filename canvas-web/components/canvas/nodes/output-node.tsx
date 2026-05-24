"use client";

import { useCallback, useMemo, useState } from "react";
import { useEdges, useNodes, type NodeProps } from "@xyflow/react";
import { Download, ImageIcon, Split } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { directPredecessors } from "@/lib/canvas/topo";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  ImageNodeData,
  OutputNodeData,
} from "@/lib/canvas/types";
import { resolveProductMainImage } from "@/lib/canvas/upstream-images";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { NodeShell } from "../node-shell";
import {
  CompareModal,
  refSideId,
  taskSideId,
  type CompareReferenceImage,
} from "../compare-modal";
import { MediaHoverBox } from "../media-hover-box";
import {
  NODE_BTN_ACCENT,
  NODE_BTN_GHOST,
  NODE_MEDIA_MIN_WIDTH,
  NodeMediaEmpty,
  NodeMediaGallery,
  NodeMediaItem,
  NodeMediaStage,
} from "../node-ui";

function resolveUpstreamImageEngineId(
  edges: CanvasFlowEdge[],
  nodes: CanvasFlowNode[],
  nodeId: string,
): string | null {
  for (const pid of directPredecessors(edges, nodeId)) {
    const n = nodes.find((x) => x.id === pid);
    if (n?.type === "image-engine" || n?.type === "three-view-engine") return pid;
  }
  return null;
}

function resolveSingleImagePreview(
  edges: CanvasFlowEdge[],
  nodes: CanvasFlowNode[],
  nodeId: string,
): string | null {
  for (const pid of directPredecessors(edges, nodeId)) {
    const n = nodes.find((x) => x.id === pid);
    if (!n) continue;
    if (n.type === "image") {
      const d = n.data as unknown as ImageNodeData;
      if (d.ossUrl) return d.ossUrl;
      if (d.blobUrl) return d.blobUrl;
    }
  }
  return null;
}

type CompareState = {
  defaultLeftId?: string;
  defaultRightId?: string;
};


export function OutputNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const storeNodes = useCanvasStore((s) => s.nodes);
  const storeEdges = useCanvasStore((s) => s.edges);
  const d = data as unknown as OutputNodeData;
  const nodes = useNodes() as CanvasFlowNode[];
  const edges = useEdges();

  const [compareState, setCompareState] = useState<CompareState | null>(null);

  const upstreamEngineId = useMemo(
    () => resolveUpstreamImageEngineId(edges, nodes, id),
    [edges, nodes, id],
  );
  const { history, succeeded } = useNodeTaskHistory(upstreamEngineId);
  const fallbackPreview = useMemo(
    () => resolveSingleImagePreview(edges, nodes, id),
    [edges, nodes, id],
  );

  const productMain = useMemo(() => {
    if (upstreamEngineId) {
      return resolveProductMainImage(storeNodes, storeEdges, upstreamEngineId);
    }
    return resolveProductMainImage(storeNodes, storeEdges, id);
  }, [storeNodes, storeEdges, upstreamEngineId, id]);

  const referenceImages = useMemo<CompareReferenceImage[]>(() => {
    if (!productMain) return [];
    return [{ id: "product-main", url: productMain.url, label: productMain.label }];
  }, [productMain]);

  const previewUrls = useMemo(() => {
    if (succeeded.length > 0) {
      return succeeded.map((t) => t.ossUrl!).filter(Boolean);
    }
    return fallbackPreview ? [fallbackPreview] : [];
  }, [succeeded, fallbackPreview]);

  const canCompare =
    succeeded.length >= 2 ||
    (succeeded.length >= 1 && referenceImages.length > 0);

  const openCompare = useCallback((state?: CompareState) => {
    setCompareState(state ?? {});
  }, []);

  return (
    <>
      <NodeShell
        title="输出"
        subtitle={d.title ?? "未命名画作"}
        selected={selected}
        runtime={d.runtime}
        minWidth={NODE_MEDIA_MIN_WIDTH}
        minHeight={480}
        inputs={[{ id: "in_image", label: "最终画面", kind: "image" }]}
      >
        <div className="flex h-full flex-col gap-2">
          {canCompare ? (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => openCompare()} className={NODE_BTN_ACCENT}>
                <Split className="size-3" /> 对比
              </button>
              {productMain && succeeded.length >= 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    openCompare({
                      defaultLeftId: refSideId("product-main"),
                      defaultRightId: taskSideId(
                        succeeded[succeeded.length - 1]!.id,
                      ),
                    })
                  }
                  className={NODE_BTN_GHOST}
                >
                  与主图对比
                </button>
              ) : null}
            </div>
          ) : null}

          <NodeMediaGallery>
            {succeeded.length > 0 ? (
              succeeded.map((t, idx) => {
                const prev = idx > 0 ? succeeded[idx - 1] : null;
                return (
                  <NodeMediaItem
                    key={t.id}
                    stage={
                      <NodeMediaStage>
                        <MediaHoverBox
                          src={t.ossUrl!}
                          variant="generated"
                          alt={`output-${idx + 1}`}
                          fit="contain"
                          clickToPreview
                          compareContext={
                            canCompare && upstreamEngineId
                              ? {
                                  tasks: history,
                                  referenceImages,
                                  focusTaskId: t.id,
                                }
                              : undefined
                          }
                        />
                      </NodeMediaStage>
                    }
                    actions={
                      <>
                        <span className="text-[11px] text-white/50">#{idx + 1}</span>
                        {productMain ? (
                          <button
                            type="button"
                            onClick={() =>
                              openCompare({
                                defaultLeftId: refSideId("product-main"),
                                defaultRightId: taskSideId(t.id),
                              })
                            }
                            className={NODE_BTN_GHOST}
                          >
                            与主图对比
                          </button>
                        ) : null}
                        {prev ? (
                          <button
                            type="button"
                            onClick={() =>
                              openCompare({
                                defaultLeftId: taskSideId(prev.id),
                                defaultRightId: taskSideId(t.id),
                              })
                            }
                            className={NODE_BTN_GHOST}
                          >
                            与上一张对比
                          </button>
                        ) : null}
                        <a
                          href={t.ossUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${NODE_BTN_GHOST} ml-auto`}
                        >
                          <Download className="size-3" /> 下载
                        </a>
                      </>
                    }
                  />
                );
              })
            ) : previewUrls.length > 0 ? (
              previewUrls.map((url, idx) => (
                <NodeMediaItem
                  key={`${url}-${idx}`}
                  stage={
                    <NodeMediaStage>
                      <MediaHoverBox
                        src={url}
                        variant="generated"
                        alt={`output-${idx + 1}`}
                        fit="contain"
                      />
                    </NodeMediaStage>
                  }
                />
              ))
            ) : (
              <NodeMediaEmpty icon={<ImageIcon className="size-6 opacity-40" />} />
            )}
          </NodeMediaGallery>

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
              onChange={(e) =>
                updateNodeData(id, { saveToGallery: e.target.checked })
              }
            />
            保存到画作库
          </label>
        </div>
      </NodeShell>

      {compareState && upstreamEngineId ? (
        <CompareModal
          tasks={history}
          referenceImages={referenceImages}
          defaultLeftId={compareState.defaultLeftId}
          defaultRightId={compareState.defaultRightId}
          onClose={() => setCompareState(null)}
        />
      ) : null}
    </>
  );
}
