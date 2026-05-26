"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
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
      minWidth={520}
      minHeight={480}
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
              在「故事大纲」生成角色设定后，此处显示各角色与三视图。
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
                  generateTitle={url ? "重生成" : "生成"}
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
