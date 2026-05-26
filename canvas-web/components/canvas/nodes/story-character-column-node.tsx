"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { NODE_DEFAULT_SIZE, THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { displayCharacterRows } from "@/lib/canvas/story-column-display";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import type { StoryCharacterColumnNodeData } from "@/lib/canvas/story-workspace-types";
import { StoryColumnBatchFooter } from "../story-column-batch-footer";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryColumnRowCard } from "../story-row-prompt-field";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { NodeShell, ENGINE_ACCENT } from "../node-shell";
import { EnginePicker } from "../engine-picker";

export function StoryCharacterColumnNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const d = data as unknown as StoryCharacterColumnNodeData;
  const stored = d.rows ?? [];
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const displayRows = useMemo(
    () => displayCharacterRows(nodes, id, stored),
    [nodes, id, stored],
  );

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(displayRows),
    [displayRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  useEffect(() => {
    const def = NODE_DEFAULT_SIZE["story-character-column"];
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
      mediaKind: "threeView",
      forceFresh,
    });
  };

  const runAll = () => {
    const keys = displayRows.map((r) => r.key);
    if (!keys.length || !d.batchImage?.providerId) return;
    updateRows(displayRows);
    batchRunStoryRowsSequential(id, keys, "threeView");
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
      title="角色设定与三视图"
      subtitle={
        columnGenerating
          ? "三视图生成中…"
          : nodeRuntime.status === "error"
            ? "部分生成失败"
            : "定位来自角色设定"
      }
      selected={selected}
      engine
      bodyScroll
      runtime={nodeRuntime}
      accent={ENGINE_ACCENT}
      minWidth={NODE_DEFAULT_SIZE["story-character-column"].width}
      minHeight={NODE_DEFAULT_SIZE["story-character-column"].height}
      inputs={[
        { id: "in_text", label: "角色设定", kind: "text" },
      ]}
      outputs={[{ id: "text", label: "三视图", kind: "image" }]}
      footer={
        <StoryNodeFooterShell>
          <StoryColumnBatchFooter
            disabled={
              columnGenerating ||
              !displayRows.length ||
              !d.batchImage?.providerId
            }
            onClick={runAll}
          >
            <Users className="mr-1 inline size-3.5" />
            全部生成三视图
          </StoryColumnBatchFooter>
        </StoryNodeFooterShell>
      }
    >
      <div className="flex shrink-0 flex-col gap-2">
        <EnginePicker
          role="IMAGE"
          allowedModelKeys={[...THREE_VIEW_ENGINE_MODEL_KEYS]}
          providerId={d.batchImage?.providerId ?? ""}
          modelKey={d.batchImage?.modelKey ?? ""}
          params={d.batchImage?.params ?? {}}
          onChange={onPickImage}
        />
        <div className="space-y-2">
          {!displayRows.length ? (
            <p className="text-[11px] text-[var(--canvas-muted)]">
              定稿大纲中若无角色设定，此列可为空；需要时再生成三视图。
            </p>
          ) : (
            displayRows.map((row) => {
              const url = row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
              const st = row.runtime?.status ?? "idle";
              const running = st === "running" || st === "pending";
              return (
                <StoryColumnRowCard
                  key={row.key}
                  rowTitle={row.name}
                  promptValue={row.prompt}
                  onSavePrompt={(p) => saveRowPrompt(row.key, p)}
                  generating={running}
                  mediaMode="character"
                  imageUrl={url}
                  onGenerate={() => runRow(row.key, Boolean(url))}
                  onPreview={
                    url
                      ? () =>
                          setPreview({ url, title: `${row.name} · 三视图` })
                      : undefined
                  }
                />
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
