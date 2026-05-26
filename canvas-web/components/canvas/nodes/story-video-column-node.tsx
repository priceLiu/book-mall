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
    const frameNode = nodes.find((n) => n.id === frameColumnId);
    const frameStored =
      (frameNode?.data as StoryFrameColumnNodeData)?.rows ?? [];
    const frameRows = displayFrameRows(nodes, frameColumnId, frameStored);
    return patchVideoRowsFromFrameRows(stored, frameRows);
  }, [frameColumnId, nodes, stored]);

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
            : "各镜成片 · 在分镜脚本列生成"
      }
      selected={selected}
      engine
      bodyExpand
      runtime={nodeRuntime}
      accent={ENGINE_ACCENT}
      minWidth={360}
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
            在「分镜脚本」列生成后，各镜成片将纵向排列显示于此。
          </p>
        ) : (
          displayRows.map((row) => {
            const vid =
              row.videoRuntime?.ossUrl ?? row.videoRuntime?.ephemeralUrl;
            const st = row.videoRuntime?.status ?? "idle";
            const running = st === "running" || st === "pending";
            return (
              <StoryVideoRowSlot
                key={row.key}
                frameIndex={row.frameIndex}
                videoUrl={vid}
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
