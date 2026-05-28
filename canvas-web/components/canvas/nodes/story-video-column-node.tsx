"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useCanvasStore } from "@/lib/canvas/store";
import { filterStoryProVideoModelKeys } from "@/lib/canvas/story-frame-gate";
import { pickDefaultStoryVideoEngine } from "@/lib/canvas/system-providers";
import { STORY_PRO_VIDEO_MODEL_KEYS } from "@/lib/canvas/types";
import {
  displayFrameRows,
  displayVideoRows,
  findWorkspaceForColumnId,
} from "@/lib/canvas/story-column-display";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import {
  PRO_HINT_LABEL_CLASS,
  PRO_NODE_SHELL_FOOTER_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import { STORY_HINT_LABEL_CLASS } from "@/lib/canvas/story-column-sync";
import {
  storyEditionAccent,
  storyEditionFromNodeType,
} from "@/lib/canvas/story-edition-chrome";
import { storyVideoGenerateBlockReason } from "@/lib/canvas/story-frame-gate";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import { commitStoryVideoRowRun } from "@/lib/canvas/story-video-run";
import type {
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "@/lib/canvas/story-workspace-types";
import { STORY_VIDEO_SLOT, storyVideoColumnSize } from "@/lib/canvas/story-column-layout";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import { StoryVideoRowSlot } from "../story-video-row-slot";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { EnginePicker } from "../engine-picker";
import { NodeShell } from "../node-shell";

export function StoryVideoColumnNode({ id, data, selected, type }: NodeProps) {
  const edition = storyEditionFromNodeType(type);
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const { providers } = useUserProviders();
  const hintLabelClass =
    edition === "pro" ? PRO_HINT_LABEL_CLASS : STORY_HINT_LABEL_CLASS;
  const d = data as unknown as StoryVideoColumnNodeData;
  const stored = d.rows ?? [];
  const { alert } = useDialogs();
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [videoInflightKeys, setVideoInflightKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const ws = useMemo(
    () => findWorkspaceForColumnId(nodes, edges, id),
    [nodes, edges, id],
  );
  const frameColumnId = d.frameColumnId ?? ws?.frameColumnId;

  const frameRows = useMemo(() => {
    const colFrameId = frameColumnId ?? ws?.frameColumnId;
    if (!colFrameId) return [];
    const frameNode = nodes.find((n) => n.id === colFrameId);
    const frameStored =
      (frameNode?.data as StoryFrameColumnNodeData | undefined)?.rows ?? [];
    return displayFrameRows(nodes, colFrameId, frameStored);
  }, [nodes, frameColumnId, ws?.frameColumnId]);

  const displayRows = useMemo(
    () => displayVideoRows(nodes, id, stored),
    [nodes, id, stored],
  );

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(displayRows),
    [displayRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  const targetSize = useMemo(
    () => storyVideoColumnSize(displayRows, frameRows.length),
    [displayRows, frameRows.length],
  );

  useEffect(() => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (
      Math.abs(h - targetSize.height) < 4 &&
      Math.abs(w - targetSize.width) < 4
    ) {
      return;
    }
    resizeNode(id, { width: targetSize.width, height: targetSize.height });
  }, [id, resizeNode, targetSize]);

  const batchVideo = useMemo((): CanvasEnginePick | undefined => {
    if (d.batchVideo?.providerId) return d.batchVideo;
    if (!frameColumnId) return d.batchVideo;
    const frame = nodes.find((n) => n.id === frameColumnId)?.data as
      | StoryFrameColumnNodeData
      | undefined;
    const fromFrame = frame?.batchVideo ?? frame?.batchImage;
    return fromFrame?.providerId ? fromFrame : d.batchVideo;
  }, [d.batchVideo, frameColumnId, nodes]);

  const canGenerateVideo = Boolean(
    batchVideo?.providerId?.trim() && batchVideo?.modelKey?.trim(),
  );

  const storyVideoModelKeys = useMemo(
    () =>
      edition === "pro"
        ? filterStoryProVideoModelKeys(STORY_PRO_VIDEO_MODEL_KEYS)
        : [...STORY_PRO_VIDEO_MODEL_KEYS],
    [edition],
  );

  /** 旧画布可能未配 VIDEO；自动选系统默认（兼容分镜列遗留 batchVideo） */
  useEffect(() => {
    if (d.batchVideo?.providerId?.trim() && d.batchVideo?.modelKey?.trim()) {
      return;
    }
    if (frameColumnId) {
      const frame = nodes.find((n) => n.id === frameColumnId)?.data as
        | StoryFrameColumnNodeData
        | undefined;
      const legacy = frame?.batchVideo ?? frame?.batchImage;
      if (legacy?.providerId?.trim() && legacy?.modelKey?.trim()) {
        updateNodeData(id, {
          batchVideo: {
            providerId: legacy.providerId,
            modelKey: legacy.modelKey,
            params: legacy.params ?? {},
          },
        });
        return;
      }
    }
    const pick = pickDefaultStoryVideoEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      batchVideo: {
        providerId: pick.providerId,
        modelKey: pick.modelKey,
        params: d.batchVideo?.params ?? {},
      },
    });
  }, [
    d.batchVideo?.modelKey,
    d.batchVideo?.params,
    d.batchVideo?.providerId,
    frameColumnId,
    id,
    nodes,
    providers,
    updateNodeData,
  ]);

  const runRowVideo = async (key: string) => {
    if (!batchVideo?.providerId?.trim() || !batchVideo?.modelKey?.trim()) return;
    const colFrameId = frameColumnId ?? ws?.frameColumnId;
    if (!colFrameId) return;

    setVideoInflightKeys((prev) => new Set(prev).add(key));

    const frameNode = nodes.find((n) => n.id === colFrameId);
    const frameStored =
      (frameNode?.data as StoryFrameColumnNodeData | undefined)?.rows ?? [];
    const frameRows = displayFrameRows(nodes, colFrameId, frameStored);
    const frameRow = frameRows.find((r) => r.key === key);
    const frameImageUrl =
      frameRow?.runtime?.ossUrl ?? frameRow?.runtime?.ephemeralUrl;

    try {
      const result = await commitStoryVideoRowRun({
        base,
        projectId,
        videoColumnId: id,
        frameColumnId: colFrameId,
        rowKey: key,
        frameImageUrl,
        batchVideo: {
          providerId: batchVideo.providerId,
          modelKey: batchVideo.modelKey,
          params: batchVideo.params ?? {},
        },
        forceFresh: true,
      });
      if (!result.ok) {
        void alert({
          title: "分镜视频生成失败",
          message: result.error,
          variant: "error",
        });
      }
    } finally {
      setVideoInflightKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
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
      bodyScroll
      runtime={nodeRuntime}
      accent={storyEditionAccent(edition)}
      minWidth={targetSize.width}
      minHeight={targetSize.height}
      inputs={[{ id: "in_text", label: "分镜", kind: "text" }]}
      outputs={[{ id: "text", label: "视频", kind: "image" }]}
      footerClassName={
        edition === "pro" ? PRO_NODE_SHELL_FOOTER_CLASS : undefined
      }
    >
      <div className="flex w-full flex-col gap-2">
        <div className="shrink-0 space-y-1.5">
          <p className={hintLabelClass}>
            分镜视频 · VIDEO（点击生成，不自动跑）
            {!canGenerateVideo ? (
              <span className="ml-1 normal-case text-amber-300/90">
                · 请先选择视频模型
              </span>
            ) : null}
          </p>
          <EnginePicker
            role="VIDEO"
            allowedModelKeys={storyVideoModelKeys}
            capabilityHint="分镜视频支持 KIE 图生视频（含 Seedance 2 多参考）与 Gateway · 百炼参考生视频（万相 / HappyHorse R2V）"
            providerId={batchVideo?.providerId ?? ""}
            modelKey={batchVideo?.modelKey ?? ""}
            params={batchVideo?.params ?? {}}
            onChange={(next) => {
              updateNodeData(id, {
                batchVideo: {
                  providerId: next.providerId,
                  modelKey: next.modelKey,
                  params: next.params,
                },
                frameColumnId,
              });
            }}
          />
        </div>
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
            const running =
              st === "running" ||
              st === "pending" ||
              videoInflightKeys.has(row.key);
            const videoError =
              st === "error" ? row.videoRuntime?.failMessage : undefined;
            const frameRow = frameRows.find((f) => f.key === row.key);
            const videoBlockReason = storyVideoGenerateBlockReason(frameRow);
            const videoPrompt =
              frameRow?.prompt?.trim() ||
              (row.videoPrompt ?? "").trim() ||
              (row.dialogue ?? "").trim();
            const videoRefLabels = (
              row.refImages?.length ? row.refImages : frameRow?.refImages ?? []
            )
              .filter((r) => r.id.startsWith("ref-char-"))
              .map((r) => r.label);
            return (
              <StoryVideoRowSlot
                key={row.key}
                edition={edition}
                frameIndex={row.frameIndex}
                videoUrl={vid}
                videoPrompt={videoPrompt}
                videoRefLabels={videoRefLabels}
                generating={running}
                errorMessage={videoError}
                videoBlockReason={videoBlockReason}
                onGenerate={() => void runRowVideo(row.key)}
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
