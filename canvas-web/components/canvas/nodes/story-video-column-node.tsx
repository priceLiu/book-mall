"use client";

import { useCallback, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  displayFrameRows,
  displayVideoRows,
  findStoryWorkspaceIds,
} from "@/lib/canvas/story-column-display";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { patchVideoRowsFromFrameRows } from "@/lib/canvas/story-column-sync";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type {
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "@/lib/canvas/story-workspace-types";
import { STORY_VIDEO_SLOT } from "@/lib/canvas/story-column-layout";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import { StoryVideoRowSlot } from "../story-video-row-slot";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { NodeShell, ENGINE_ACCENT } from "../node-shell";

export function StoryVideoColumnNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as StoryVideoColumnNodeData;
  const stored = d.rows ?? [];
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const ws = useMemo(() => findStoryWorkspaceIds(nodes), [nodes]);
  const frameColumnId = d.frameColumnId ?? ws?.frameColumnId;

  const displayRows = useMemo(
    () => displayVideoRows(nodes, id, stored),
    [nodes, id, stored],
  );

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(displayRows),
    [displayRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  const batchVideo = useMemo((): CanvasEnginePick | undefined => {
    if (d.batchVideo?.providerId) return d.batchVideo;
    if (!frameColumnId) return d.batchVideo;
    const frame = nodes.find((n) => n.id === frameColumnId)?.data as
      | StoryFrameColumnNodeData
      | undefined;
    const fromFrame = frame?.batchVideo ?? frame?.batchImage;
    return fromFrame?.providerId ? fromFrame : d.batchVideo;
  }, [d.batchVideo, frameColumnId, nodes]);

  const syncRowsFromFrame = useCallback((): typeof stored => {
    if (!frameColumnId) return stored;
    const state = useCanvasStore.getState();
    const frameNode = state.nodes.find((n) => n.id === frameColumnId);
    const frameStored =
      (frameNode?.data as StoryFrameColumnNodeData)?.rows ?? [];
    const frameRows = displayFrameRows(state.nodes, frameColumnId, frameStored);
    const videoStored =
      (state.nodes.find((n) => n.id === id)?.data as StoryVideoColumnNodeData)
        ?.rows ?? stored;
    return patchVideoRowsFromFrameRows(videoStored, frameRows);
  }, [frameColumnId, id, stored]);

  const runRowVideo = (key: string, forceFresh?: boolean) => {
    if (!batchVideo?.providerId) return;
    const patched = syncRowsFromFrame();
    updateNodeData(id, { rows: patched });
    busEnqueueStoryRun({
      nodeId: id,
      rowKey: key,
      mediaKind: "video",
      forceFresh,
    });
  };

  return (
    <NodeShell
      title="分镜视频"
      subtitle={
        columnGenerating
          ? "视频生成中…"
          : nodeRuntime.status === "error"
            ? "部分生成失败"
            : "各镜成片 · 点击生成"
      }
      selected={selected}
      engine
      bodyExpand
      runtime={nodeRuntime}
      accent={ENGINE_ACCENT}
      minWidth={400}
      minHeight={280}
      inputs={[{ id: "in_text", label: "分镜", kind: "text" }]}
      outputs={[{ id: "text", label: "视频", kind: "image" }]}
    >
      <div
        className="flex w-full flex-col"
        style={{ gap: STORY_VIDEO_SLOT.slotGap }}
      >
        {!displayRows.length ? (
          <p className="text-[11px] text-[var(--canvas-muted)]">
            在「分镜脚本」列生成分镜图后，点击此处或分镜图上的视频图标生成成片。
          </p>
        ) : (
          displayRows.map((row) => {
            const vid =
              row.videoRuntime?.ossUrl ?? row.videoRuntime?.ephemeralUrl;
            const st = row.videoRuntime?.status ?? "idle";
            const running = st === "running" || st === "pending";
            const videoPrompt =
              (row.videoPrompt ?? "").trim() ||
              [row.dialogue].filter(Boolean).join("\n");
            return (
              <StoryVideoRowSlot
                key={row.key}
                frameIndex={row.frameIndex}
                videoUrl={vid}
                videoPrompt={videoPrompt}
                generating={running}
                onGenerate={() => runRowVideo(row.key, Boolean(vid))}
                onPreview={
                  vid
                    ? () =>
                        setPreview({
                          url: vid,
                          title: `镜 ${row.frameIndex}`,
                        })
                    : undefined
                }
              />
            );
          })
        )}
      </div>
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          kind="video"
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </NodeShell>
  );
}
