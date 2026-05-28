"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { MapPin } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { storyEditionAccent } from "@/lib/canvas/story-edition-chrome";
import { PRO_NODE_SHELL_FOOTER_CLASS } from "@/lib/canvas/story-pro-node-chrome";
import { NODE_DEFAULT_SIZE, THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import type { StoryProSceneColumnNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { findAssetForSceneRow } from "@/lib/canvas/story-pro-scene-asset-catalog";
import { useStoryProSceneAssets } from "@/lib/canvas/use-story-pro-scene-assets";
import { StoryColumnBatchFooter } from "../story-column-batch-footer";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryColumnRowCard } from "../story-row-prompt-field";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { StoryProSceneAssetSlots } from "../story-pro-scene-asset-slots";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";

export function StoryProSceneColumnNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const projectId = useCanvasStore((s) => s.projectId);
  const { assets: sceneAssets } = useStoryProSceneAssets(projectId);
  const d = data as unknown as StoryProSceneColumnNodeData;
  const stored = d.rows ?? [];
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const displayRows = stored;

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(displayRows),
    [displayRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  useEffect(() => {
    const def = NODE_DEFAULT_SIZE["story-pro-scene"];
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - def.height) < 4 && Math.abs(w - def.width) < 4) return;
    resizeNode(id, { width: def.width, height: def.height });
  }, [id, resizeNode]);

  const updateRows = (next: typeof displayRows) => {
    updateNodeData(id, { rows: next });
  };

  const onPickImage = (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      batchImage: {
        providerId: next.providerId,
        modelKey: next.modelKey,
        params: next.params,
      },
    });
  };

  const runRow = (key: string, forceFresh?: boolean) => {
    updateRows(displayRows);
    busEnqueueStoryRun({
      nodeId: id,
      rowKey: key,
      mediaKind: "sceneRef",
      forceFresh,
    });
  };

  const runAll = () => {
    const keys = displayRows.map((r) => r.key);
    if (!keys.length || !d.batchImage?.providerId) return;
    updateRows(displayRows);
    for (const key of keys) {
      busEnqueueStoryRun({
        nodeId: id,
        rowKey: key,
        mediaKind: "sceneRef",
      });
    }
  };

  const saveRowPrompt = (key: string, prompt: string) => {
    const next = displayRows.map((r) =>
      r.key === key
        ? {
            ...r,
            prompt: prompt.trim(),
            promptHistory: pushStoryRevision(r.promptHistory, prompt),
          }
        : r,
    );
    updateRows(next);
  };

  return (
    <NodeShell
      title="场景设计"
      subtitle={
        columnGenerating
          ? "场景参考图生成中…"
          : nodeRuntime.status === "error"
            ? "部分生成失败"
            : "来自分镜场景列"
      }
      selected={selected}
      engine
      bodyScroll
      runtime={nodeRuntime}
      accent={storyEditionAccent("pro")}
      minWidth={NODE_DEFAULT_SIZE["story-pro-scene"].width}
      minHeight={NODE_DEFAULT_SIZE["story-pro-scene"].height}
      inputs={[{ id: "in_text", label: "人物设计", kind: "text" }]}
      outputs={[{ id: "text", label: "场景参考", kind: "image" }]}
      footerClassName={PRO_NODE_SHELL_FOOTER_CLASS}
      footer={
        <StoryNodeFooterShell>
          <StoryColumnBatchFooter
            edition="pro"
            disabled={
              columnGenerating ||
              !displayRows.length ||
              !d.batchImage?.providerId
            }
            onClick={runAll}
          >
            <MapPin className="mr-1 inline size-3.5" />
            全部生成场景参考
          </StoryColumnBatchFooter>
        </StoryNodeFooterShell>
      }
    >
      <div className="flex shrink-0 flex-col gap-2">
        <EnginePicker
          role="IMAGE"
          allowedModelKeys={[...THREE_VIEW_ENGINE_MODEL_KEYS]}
          requiredCapabilities={["image_multi_ref"]}
          capabilityHint="场景参考图若带 @ 多图引用，需支持 multi_ref 的模型"
          providerId={d.batchImage?.providerId ?? ""}
          modelKey={d.batchImage?.modelKey ?? ""}
          params={d.batchImage?.params ?? {}}
          onChange={onPickImage}
        />
        <div className="space-y-2">
          {!displayRows.length ? (
            <p className="text-[11px] text-[var(--canvas-muted)]">
              风格定稿后从分镜表拆分场景行；需要时再生成场景参考图。
            </p>
          ) : (
            displayRows.map((row) => {
              const url = row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
              const st = row.runtime?.status ?? "idle";
              const running = st === "running" || st === "pending";
              const rowAsset = findAssetForSceneRow(sceneAssets, row.key, projectId);
              return (
                <div key={row.key} className="space-y-1">
                  <StoryColumnRowCard
                    edition="pro"
                    rowTitle={row.name}
                    promptValue={row.prompt}
                    onSavePrompt={(p) => saveRowPrompt(row.key, p)}
                    generating={running}
                    generateDisabled={
                      !d.batchImage?.providerId?.trim() ||
                      !d.batchImage?.modelKey?.trim()
                    }
                    mediaMode="character"
                    imageUrl={url}
                    mediaError={
                      st === "error" ? row.runtime?.failMessage : undefined
                    }
                    onGenerate={() => runRow(row.key, Boolean(url))}
                    onPreview={
                      url
                        ? () =>
                            setPreview({ url, title: `${row.name} · 场景参考` })
                        : undefined
                    }
                  />
                  <StoryProSceneAssetSlots
                    row={row}
                    asset={rowAsset}
                    projectId={projectId}
                    onPreview={(u, title) => setPreview({ url: u, title })}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </NodeShell>
  );
}
