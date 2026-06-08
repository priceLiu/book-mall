"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  useCanvasGraphSnapshot,
  useCanvasStoreActions,
} from "@/lib/canvas/canvas-store-hooks";
import { filterStoryProVideoModelKeys } from "@/lib/canvas/story-frame-gate";
import {
  pickDefaultStoryTtsEngine,
  pickDefaultStoryVideoEngine,
} from "@/lib/canvas/system-providers";
import { STORY_PRO_VIDEO_MODEL_KEYS, STORY_TTS_MODEL_KEYS } from "@/lib/canvas/types";
import {
  authoritativeFrameRowsForVideoColumn,
  displayVideoRowsForFrameColumn,
  findWorkspaceForColumnId,
  frameRowsForVideoColumn,
} from "@/lib/canvas/story-column-display";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { NODE_DEFAULT_SIZE } from "@/lib/canvas/types";
import { patchVideoRowsFromFrameRows } from "@/lib/canvas/story-column-sync";
import { useStoryColumnAutoSize } from "@/lib/canvas/use-story-column-auto-size";
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
import {
  commitStoryTtsRowRun,
  storyTtsDialogueText,
  storyTtsGenerateBlockReason,
} from "@/lib/canvas/story-tts-run";
import type {
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "@/lib/canvas/story-workspace-types";
import {
  storyMediaAlignedRowHeight,
  storyVideoColumnSize,
} from "@/lib/canvas/story-column-layout";
import { storyMediaListLabel } from "@/lib/canvas/story-media-grid-layout";
import { StoryEnginePickerStack } from "../story-engine-picker-stack";
import { StoryVideoColumnEngineBar } from "../story-video-column-engine-bar";
import { StoryVideoFrameCell } from "../story-video-frame-cell";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { AudioFullscreenLightbox } from "../audio-fullscreen-lightbox";
import { EnginePicker } from "../engine-picker";
import { NodeShell } from "../node-shell";
import { ColumnRowsList } from "../virtual-column-rows";

export function StoryVideoColumnNode({ id, data, selected, type }: NodeProps) {
  const edition = storyEditionFromNodeType(type);
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const { nodes, edges } = useCanvasGraphSnapshot();
  const { updateNodeData } = useCanvasStoreActions();
  const { providers } = useUserProviders();
  const hintLabelClass =
    edition === "pro" ? PRO_HINT_LABEL_CLASS : STORY_HINT_LABEL_CLASS;
  const d = data as unknown as StoryVideoColumnNodeData;
  const stored = d.rows ?? [];
  const { alert } = useDialogs();
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
    kind: "video" | "audio";
  } | null>(null);
  const [videoInflightKeys, setVideoInflightKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [ttsInflightKeys, setTtsInflightKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const ws = useMemo(
    () => findWorkspaceForColumnId(nodes, edges, id),
    [nodes, edges, id],
  );
  const { frameColumnId: linkedFrameColumnId, frameRows } = useMemo(
    () => frameRowsForVideoColumn(nodes, edges, id, ws),
    [nodes, edges, id, ws],
  );

  const displayRows = useMemo(
    () =>
      displayVideoRowsForFrameColumn(
        nodes,
        id,
        stored,
        linkedFrameColumnId,
        edges,
      ),
    [nodes, edges, id, stored, linkedFrameColumnId],
  );

  /** 始终以分镜脚本列镜位为准渲染（不依赖 stored 是否已写回） */
  const rowsToRender = useMemo(() => {
    if (!frameRows.length) return displayRows;
    return patchVideoRowsFromFrameRows(displayRows, frameRows);
  }, [displayRows, frameRows]);

  /** 分镜脚本镜数多于视频列 stored 时，自动补齐行（避免「分镜视频少了」） */
  useEffect(() => {
    if (!linkedFrameColumnId || !frameRows.length) return;
    const patched = patchVideoRowsFromFrameRows(stored, frameRows);
    const storedKeys = new Set(stored.map((r) => r.key));
    const needsPatch =
      patched.length !== stored.length ||
      patched.length !== frameRows.length ||
      patched.some((r) => !storedKeys.has(r.key)) ||
      d.frameColumnId !== linkedFrameColumnId;
    if (!needsPatch) return;
    updateNodeData(id, {
      rows: patched,
      frameColumnId: linkedFrameColumnId,
      manualSize: false,
    });
  }, [
    frameRows,
    id,
    linkedFrameColumnId,
    stored,
    updateNodeData,
  ]);

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(rowsToRender),
    [rowsToRender],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  const listRowCount = rowsToRender.length;

  const alignedRowH = useMemo(
    () => storyMediaAlignedRowHeight({ pro: edition === "pro" }),
    [edition],
  );

  const targetSize = useMemo(
    () =>
      storyVideoColumnSize(displayRows, listRowCount, {
        pro: edition === "pro",
      }),
    [displayRows, listRowCount, edition],
  );

  useStoryColumnAutoSize(id, targetSize, listRowCount);

  /** 宫格改版后可能残留过宽节点；非手动尺寸时收回到默认列宽 540 */
  const videoDefaultWidth = useMemo(
    () =>
      NODE_DEFAULT_SIZE[
        edition === "pro" ? "story-pro-video" : "story-video-column"
      ].width,
    [edition],
  );
  useEffect(() => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    const nextH = Math.max(h, targetSize.height);
    if (
      Math.abs(w - videoDefaultWidth) < 4 &&
      Math.abs(h - nextH) < 4
    ) {
      return;
    }
    useCanvasStore.getState().resizeNode(id, {
      width: videoDefaultWidth,
      height: nextH,
    });
  }, [id, videoDefaultWidth, targetSize.height, nodes]);

  const batchVideo = useMemo((): CanvasEnginePick | undefined => {
    if (d.batchVideo?.providerId) return d.batchVideo;
    if (!linkedFrameColumnId) return d.batchVideo;
    const frame = nodes.find((n) => n.id === linkedFrameColumnId)?.data as
      | StoryFrameColumnNodeData
      | undefined;
    const fromFrame = frame?.batchVideo ?? frame?.batchImage;
    return fromFrame?.providerId ? fromFrame : d.batchVideo;
  }, [d.batchVideo, linkedFrameColumnId, nodes]);

  const batchTts = d.batchTts;

  const canGenerateVideo = Boolean(
    batchVideo?.providerId?.trim() && batchVideo?.modelKey?.trim(),
  );

  const canGenerateTts = Boolean(
    batchTts?.providerId?.trim() && batchTts?.modelKey?.trim(),
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
    if (linkedFrameColumnId) {
      const frame = nodes.find((n) => n.id === linkedFrameColumnId)?.data as
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
    linkedFrameColumnId,
    id,
    nodes,
    providers,
    updateNodeData,
  ]);

  /** 默认 TTS · Gateway · 百炼 */
  useEffect(() => {
    if (d.batchTts?.providerId?.trim() && d.batchTts?.modelKey?.trim()) {
      return;
    }
    const pick = pickDefaultStoryTtsEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      batchTts: {
        providerId: pick.providerId,
        modelKey: pick.modelKey,
        params: d.batchTts?.params ?? {
          voice: "Cherry",
          language_type: "Chinese",
        },
      },
      frameColumnId: linkedFrameColumnId,
    });
  }, [
    d.batchTts?.modelKey,
    d.batchTts?.params,
    d.batchTts?.providerId,
    linkedFrameColumnId,
    id,
    providers,
    updateNodeData,
  ]);

  const runRowVideo = async (key: string) => {
    if (!batchVideo?.providerId?.trim() || !batchVideo?.modelKey?.trim()) return;
    if (!linkedFrameColumnId) return;

    setVideoInflightKeys((prev) => new Set(prev).add(key));

    const frameRows = authoritativeFrameRowsForVideoColumn(
      nodes,
      linkedFrameColumnId,
      edges,
    );
    const frameRow = frameRows.find((r) => r.key === key);
    const frameImageUrl =
      frameRow?.runtime?.ossUrl ?? frameRow?.runtime?.ephemeralUrl;

    try {
      const result = await commitStoryVideoRowRun({
        base,
        projectId,
        videoColumnId: id,
        frameColumnId: linkedFrameColumnId,
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

  const runRowTts = async (key: string) => {
    if (!batchTts?.providerId?.trim() || !batchTts?.modelKey?.trim()) return;
    const row = displayRows.find((r) => r.key === key);
    const dialogue = row ? storyTtsDialogueText(row) : "";
    const block = storyTtsGenerateBlockReason(row);
    if (block) {
      void alert({
        title: "无法生成配音",
        message: block,
        variant: "warning",
      });
      return;
    }

    setTtsInflightKeys((prev) => new Set(prev).add(key));
    try {
      const result = await commitStoryTtsRowRun({
        base,
        projectId,
        videoColumnId: id,
        rowKey: key,
        dialogue,
        batchTts: {
          providerId: batchTts.providerId,
          modelKey: batchTts.modelKey,
          params: batchTts.params ?? {},
        },
        forceFresh: true,
      });
      if (!result.ok) {
        void alert({
          title: "分镜配音生成失败",
          message: result.error,
          variant: "error",
        });
      }
    } finally {
      setTtsInflightKeys((prev) => {
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
          ? `${storyMediaListLabel(listRowCount)} · 生成中…`
          : nodeRuntime.status === "error"
            ? `${storyMediaListLabel(listRowCount)} · 部分失败`
            : `${storyMediaListLabel(listRowCount)} · 点击各镜生成`
      }
      selected={selected}
      engine
      bodyScroll
      runtime={nodeRuntime}
      disableGeneratingChrome
      accent={storyEditionAccent(edition)}
      minWidth={targetSize.width}
      minHeight={targetSize.height}
      inputs={[{ id: "in_text", label: "分镜", kind: "text" }]}
      outputs={[{ id: "text", label: "视频", kind: "image" }]}
      footerClassName={
        edition === "pro" ? PRO_NODE_SHELL_FOOTER_CLASS : undefined
      }
    >
      <div className="flex w-full flex-col gap-3">
        <StoryVideoColumnEngineBar
          videoPicker={
            <StoryEnginePickerStack
              label={
                <>
                  VIDEO · 图生视频
                  {!canGenerateVideo ? (
                    <span className="ml-1 normal-case text-amber-300/90">
                      · 选模型
                    </span>
                  ) : null}
                </>
              }
              labelClassName={hintLabelClass}
            >
              <EnginePicker
                role="VIDEO"
                allowedModelKeys={storyVideoModelKeys}
                capabilityHint="Kling / Wan / HappyHorse：API 仅 1 张首帧（image_urls）；多 @ 参考进 prompt 附加段。多图 API 请选 Seedance 2（reference_image_urls 最多 8 张）或百炼 R2V"
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
                    frameColumnId: linkedFrameColumnId,
                  });
                }}
              />
            </StoryEnginePickerStack>
          }
          ttsPicker={
            <StoryEnginePickerStack
              label={
                <>
                  TTS · 剪映配音轨
                  {!canGenerateTts ? (
                    <span className="ml-1 normal-case text-amber-300/90">
                      · 选模型
                    </span>
                  ) : null}
                </>
              }
              labelClassName={hintLabelClass}
            >
              <EnginePicker
                role="LLM"
                allowedModelKeys={[...STORY_TTS_MODEL_KEYS]}
                capabilityHint="经 Gateway · 百炼：qwen3-tts / tts-1 / tts-1-hd（OpenAI 兼容语音）"
                providerId={batchTts?.providerId ?? ""}
                modelKey={batchTts?.modelKey ?? ""}
                params={batchTts?.params ?? {}}
                onChange={(next) => {
                  updateNodeData(id, {
                    batchTts: {
                      providerId: next.providerId,
                      modelKey: next.modelKey,
                      params: next.params,
                    },
                    frameColumnId: linkedFrameColumnId,
                  });
                }}
              />
            </StoryEnginePickerStack>
          }
        />
        {!listRowCount ? (
          <p className="text-[11px] text-[var(--canvas-muted)]">
            在「分镜脚本」列生成分镜图后，在本列点击各镜生成视频与配音。
          </p>
        ) : (
          <ColumnRowsList
            items={rowsToRender}
            rowHeight={alignedRowH}
            getKey={(row) => row.key}
            renderRow={(row) => {
              const vid =
                row.videoRuntime?.ossUrl ?? row.videoRuntime?.ephemeralUrl;
              const st = row.videoRuntime?.status ?? "idle";
              const running =
                st === "running" ||
                st === "pending" ||
                videoInflightKeys.has(row.key);
              const videoError =
                st === "error"
                  ? formatCanvasTaskError(
                      row.videoRuntime?.failCode,
                      row.videoRuntime?.failMessage,
                    )
                  : undefined;
              const frameRow = frameRows.find((f) => f.key === row.key);
              const videoBlockReason =
                storyVideoGenerateBlockReason(frameRow);
              const videoPrompt =
                frameRow?.prompt?.trim() ||
                (row.videoPrompt ?? "").trim() ||
                (row.dialogue ?? "").trim();
              const videoRefLabels = (
                row.refImages?.length ? row.refImages : frameRow?.refImages ?? []
              )
                .filter((r) => r.id.startsWith("ref-char-"))
                .map((r) => r.label);
              const aud =
                row.ttsRuntime?.ossUrl ?? row.ttsRuntime?.ephemeralUrl;
              const ttsSt = row.ttsRuntime?.status ?? "idle";
              const ttsRunning =
                ttsSt === "running" ||
                ttsSt === "pending" ||
                ttsInflightKeys.has(row.key);
              const ttsError =
                ttsSt === "error"
                  ? formatCanvasTaskError(
                      row.ttsRuntime?.failCode,
                      row.ttsRuntime?.failMessage,
                    )
                  : undefined;
              const ttsBlockReason = storyTtsGenerateBlockReason(row);

              return (
                <StoryVideoFrameCell
                  edition={edition}
                  frameIndex={row.frameIndex}
                  videoUrl={vid}
                  videoPrompt={videoPrompt}
                  videoRefLabels={videoRefLabels}
                  videoGenerating={running}
                  videoError={videoError}
                  videoBlockReason={videoBlockReason}
                  onGenerateVideo={() => void runRowVideo(row.key)}
                  saveToLibrary={
                    vid
                      ? {
                          mode: "i2v",
                          prompt: videoPrompt,
                          modelLabel: batchVideo?.modelKey,
                        }
                      : null
                  }
                  onPreviewVideo={
                    vid
                      ? () =>
                          setPreview({
                            url: vid,
                            title: `镜 ${row.frameIndex} · 视频`,
                            kind: "video",
                          })
                      : undefined
                  }
                  audioUrl={aud}
                  dialoguePreview={storyTtsDialogueText(row)}
                  ttsGenerating={ttsRunning}
                  ttsError={ttsError}
                  ttsBlockReason={ttsBlockReason}
                  onGenerateTts={() => void runRowTts(row.key)}
                  onPreviewTts={
                    aud
                      ? () =>
                          setPreview({
                            url: aud,
                            title: `镜 ${row.frameIndex} · 配音`,
                            kind: "audio",
                          })
                      : undefined
                  }
                />
              );
            }}
          />
        )}
      </div>
      {preview?.kind === "video" ? (
        <StoryMediaPreviewModal
          url={preview.url}
          kind="video"
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
      {preview?.kind === "audio" ? (
        <AudioFullscreenLightbox
          title={preview.title}
          src={preview.url}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </NodeShell>
  );
}
