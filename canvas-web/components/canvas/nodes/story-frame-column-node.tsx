"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  STORY_VIDEO_MODEL_KEYS,
  THREE_VIEW_ENGINE_MODEL_KEYS,
} from "@/lib/canvas/types";
import {
  displayCharacterRows,
  displayFrameRows,
  displayVideoRows,
  findWorkspaceForColumnId,
  resolveStoryVideoColumnId,
} from "@/lib/canvas/story-column-display";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { commitStoryVideoRowRun } from "@/lib/canvas/story-video-run";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import {
  storyGeneratedCharacterMentionables,
  storyCharacterRefCatalog,
  storyRefImagesFromPrompt,
} from "@/lib/canvas/story-ref-image";
import {
  FRAME_ROW_AT_HINT,
  patchVideoRowsFromFrameRows,
  STORY_HINT_BODY_CLASS,
  STORY_HINT_LABEL_CLASS,
  sanitizeLegacyFramePrompt,
  stripFrameRowAtHint,
} from "@/lib/canvas/story-column-sync";
import type {
  StoryCharacterColumnNodeData,
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "@/lib/canvas/story-workspace-types";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import { NODE_DEFAULT_SIZE } from "@/lib/canvas/types";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { StoryColumnBatchFooter } from "../story-column-batch-footer";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryColumnRowCard } from "../story-row-prompt-field";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { NodeShell, ENGINE_ACCENT } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryImageEngine, pickDefaultStoryVideoEngine } from "@/lib/canvas/system-providers";

export function StoryFrameColumnNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const d = data as unknown as StoryFrameColumnNodeData;
  const stored = d.rows ?? [];
  const batchImage = d.batchImage;
  const batchVideo = d.batchVideo;
  const { providers } = useUserProviders();
  const { alert } = useDialogs();

  const canGenerateFrame = Boolean(
    batchImage?.providerId?.trim() && batchImage?.modelKey?.trim(),
  );

  const canGenerateVideo = Boolean(
    batchVideo?.providerId?.trim() && batchVideo?.modelKey?.trim(),
  );

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
  const videoColumnId = useMemo(
    () => resolveStoryVideoColumnId(nodes, edges, id, ws),
    [nodes, edges, id, ws],
  );

  const characterRows = useMemo(() => {
    if (!ws?.characterColumnId) return [];
    const charNode = nodes.find((n) => n.id === ws.characterColumnId);
    const storedChar =
      (charNode?.data as { rows?: Parameters<typeof displayCharacterRows>[2] })
        ?.rows ?? [];
    return displayCharacterRows(nodes, ws.characterColumnId, storedChar);
  }, [nodes, ws?.characterColumnId]);

  const characterCatalog = useMemo(
    () => storyCharacterRefCatalog(characterRows),
    [characterRows],
  );

  const characterMentionables = useMemo(
    () => storyGeneratedCharacterMentionables(characterRows),
    [characterRows],
  );

  const displayRows = useMemo(
    () => displayFrameRows(nodes, id, stored),
    [nodes, id, stored],
  );

  const videoRows = useMemo(() => {
    if (!videoColumnId) return [];
    const videoNode = nodes.find((n) => n.id === videoColumnId);
    const videoStored =
      (videoNode?.data as StoryVideoColumnNodeData)?.rows ?? [];
    return displayVideoRows(nodes, videoColumnId, videoStored);
  }, [nodes, videoColumnId]);

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(displayRows),
    [displayRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  useEffect(() => {
    const def = NODE_DEFAULT_SIZE["story-frame-column"];
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - def.height) < 4 && Math.abs(w - def.width) < 4) return;
    resizeNode(id, { width: def.width, height: def.height });
  }, [id, resizeNode]);

  /** 旧画布可能只配了 VIDEO；自动继承角色列 IMAGE 或系统默认 */
  useEffect(() => {
    if (batchImage?.providerId?.trim() && batchImage?.modelKey?.trim()) {
      return;
    }
    const charCol = ws?.characterColumnId
      ? nodes.find((n) => n.id === ws.characterColumnId)
      : undefined;
    const charBatch = (charCol?.data as StoryCharacterColumnNodeData | undefined)
      ?.batchImage;
    if (charBatch?.providerId?.trim() && charBatch?.modelKey?.trim()) {
      updateNodeData(id, {
        batchImage: {
          providerId: charBatch.providerId,
          modelKey: charBatch.modelKey,
          params: charBatch.params ?? {},
        },
      });
      return;
    }
    const pick = pickDefaultStoryImageEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      batchImage: {
        providerId: pick.providerId,
        modelKey: pick.modelKey,
        params: { aspect_ratio: "16:9", resolution: "2K", output_format: "png" },
      },
    });
  }, [
    batchImage?.providerId,
    batchImage?.modelKey,
    id,
    nodes,
    providers,
    updateNodeData,
    ws?.characterColumnId,
  ]);

  /** 旧画布可能未配 VIDEO；自动选系统默认 */
  useEffect(() => {
    if (batchVideo?.providerId?.trim() && batchVideo?.modelKey?.trim()) {
      return;
    }
    const pick = pickDefaultStoryVideoEngine(providers);
    if (!pick) return;
    const next = {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
      params: batchVideo?.params ?? {},
    };
    updateNodeData(id, { batchVideo: next });
    if (videoColumnId) {
      updateNodeData(videoColumnId, { batchVideo: next });
    }
  }, [
    batchVideo?.modelKey,
    batchVideo?.params,
    batchVideo?.providerId,
    id,
    providers,
    updateNodeData,
    videoColumnId,
  ]);

  const updateRows = (next: typeof displayRows) => {
    updateNodeData(id, { rows: next });
  };

  const runRowVideo = async (key: string, frameUrl?: string) => {
    if (!videoColumnId || !canGenerateVideo || !batchVideo) return;
    setVideoInflightKeys((prev) => new Set(prev).add(key));
    try {
      const result = await commitStoryVideoRowRun({
        base,
        projectId,
        videoColumnId,
        frameColumnId: id,
        rowKey: key,
        frameImageUrl: frameUrl,
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

  const runRowFrame = (key: string, forceFresh?: boolean) => {
    if (!canGenerateFrame) return;
    updateRows(displayRows);
    busEnqueueStoryRun({
      nodeId: id,
      rowKey: key,
      mediaKind: "frameImage",
      forceFresh,
    });
  };

  const runAllFrames = () => {
    const keys = displayRows.map((r) => r.key);
    if (!keys.length || !canGenerateFrame) return;
    updateRows(displayRows);
    batchRunStoryRowsSequential(id, keys, "frameImage");
  };

  const saveRowPrompt = (
    key: string,
    prompt: string,
    referencedIds: string[],
  ) => {
    const refImages = storyRefImagesFromPrompt(prompt, characterCatalog);
    const refImageUrls = refImages
      .map((ref) => ref.url)
      .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
    const next = displayRows.map((r) =>
      r.key === key
        ? {
            ...r,
            prompt: sanitizeLegacyFramePrompt(prompt.trim()) || prompt.trim(),
            referencedNodeIds: referencedIds,
            refImages,
            refImageUrls,
            promptHistory: pushStoryRevision(r.promptHistory, prompt),
          }
        : r,
    );
    updateRows(next);
    if (videoColumnId) {
      const videoNode = nodes.find((n) => n.id === videoColumnId);
      const videoStored =
        (videoNode?.data as StoryVideoColumnNodeData)?.rows ?? [];
      updateNodeData(videoColumnId, {
        rows: patchVideoRowsFromFrameRows(videoStored, next),
      });
    }
  };

  return (
    <NodeShell
      title="分镜脚本"
      subtitle={
        columnGenerating
          ? "分镜图生成中…"
          : nodeRuntime.status === "error"
            ? "部分生成失败"
            : "场景 · 镜头描述 · @ 角色 · 手动生成视频"
      }
      selected={selected}
      engine
      bodyScroll
      runtime={nodeRuntime}
      accent={ENGINE_ACCENT}
      minWidth={NODE_DEFAULT_SIZE["story-frame-column"].width}
      minHeight={NODE_DEFAULT_SIZE["story-frame-column"].height}
      inputs={[{ id: "in_text", label: "分镜脚本", kind: "text" }]}
      outputs={[{ id: "text", label: "分镜图", kind: "image" }]}
      footer={
        <StoryNodeFooterShell>
          <StoryColumnBatchFooter
            disabled={
              columnGenerating ||
              !displayRows.length ||
              !canGenerateFrame
            }
            onClick={runAllFrames}
          >
            <ImageIcon className="mr-1 inline size-3.5" />
            批量生成分镜图
          </StoryColumnBatchFooter>
        </StoryNodeFooterShell>
      }
    >
      <div className="flex shrink-0 flex-col gap-2">
        <div className="space-y-1.5">
          <p className={STORY_HINT_LABEL_CLASS}>
            分镜图 · IMAGE
            {!canGenerateFrame ? (
              <span className="ml-1 normal-case text-amber-300/90">
                · 请先选择生图模型
              </span>
            ) : null}
          </p>
          <EnginePicker
            role="IMAGE"
            allowedModelKeys={[...THREE_VIEW_ENGINE_MODEL_KEYS]}
            providerId={batchImage?.providerId ?? ""}
            modelKey={batchImage?.modelKey ?? ""}
            params={batchImage?.params ?? {}}
            onChange={(next) => {
              updateNodeData(id, {
                batchImage: {
                  providerId: next.providerId,
                  modelKey: next.modelKey,
                  params: next.params,
                },
              });
            }}
          />
        </div>
        <div className="space-y-1.5 border-t border-white/5 pt-2">
          <p className={STORY_HINT_LABEL_CLASS}>
            分镜视频 · VIDEO（点击生成，不自动跑）
            {!canGenerateVideo ? (
              <span className="ml-1 normal-case text-amber-300/90">
                · 请先选择视频模型
              </span>
            ) : null}
          </p>
          <EnginePicker
            role="VIDEO"
            allowedModelKeys={[...STORY_VIDEO_MODEL_KEYS]}
            providerId={batchVideo?.providerId ?? ""}
            modelKey={batchVideo?.modelKey ?? ""}
            params={batchVideo?.params ?? {}}
            onChange={(next) => {
              const pick = {
                providerId: next.providerId,
                modelKey: next.modelKey,
                params: next.params,
              };
              updateNodeData(id, { batchVideo: pick });
              if (videoColumnId) {
                updateNodeData(videoColumnId, { batchVideo: pick });
              }
            }}
          />
        </div>
        <div className="space-y-2">
          {!displayRows.length ? (
            <p className={STORY_HINT_BODY_CLASS}>
              完成分镜脚本后，在此编辑场景、镜头描述与运镜；@ 角色三视图后生成分镜图，再手动触发生成视频。
            </p>
          ) : (
            displayRows.map((row) => {
              const frameUrl =
                row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
              const fst = row.runtime?.status ?? "idle";
              const frameRunning = fst === "running" || fst === "pending";
              const vr = videoRows.find((v) => v.key === row.key);
              const vst = vr?.videoRuntime?.status ?? "idle";
              const videoRunning =
                vst === "running" ||
                vst === "pending" ||
                videoInflightKeys.has(row.key);
              const videoError =
                vst === "error" ? vr?.videoRuntime?.failMessage : undefined;
              const upstreamImages = storyRefImagesFromPrompt(
                row.prompt,
                characterCatalog,
              );
              return (
                <StoryColumnRowCard
                  key={row.key}
                  rowTitle={`镜 ${row.frameIndex}`}
                  promptValue={stripFrameRowAtHint(row.prompt)}
                  promptHint={
                    row.frameIndex === 1 ? FRAME_ROW_AT_HINT : undefined
                  }
                  showUpstream
                  upstreamImages={upstreamImages}
                  mentionables={characterMentionables}
                  onSavePrompt={(p, refs) => saveRowPrompt(row.key, p, refs)}
                  mediaMode="frame"
                  imageUrl={frameUrl}
                  generating={frameRunning || videoRunning}
                  generateDisabled={!canGenerateFrame}
                  onGenerate={() => runRowFrame(row.key, Boolean(frameUrl))}
                  onGenerateVideo={
                    frameUrl && canGenerateVideo && videoColumnId
                      ? () => void runRowVideo(row.key, frameUrl)
                      : undefined
                  }
                  mediaError={videoError}
                  videoPrompt={row.prompt}
                  videoRefLabels={upstreamImages
                    .filter((r) => r.id.startsWith("ref-char-"))
                    .map((r) => r.label)}
                  onPreview={
                    frameUrl
                      ? () =>
                          setPreview({
                            url: frameUrl,
                            title: `镜 ${row.frameIndex} · 分镜图`,
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
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </NodeShell>
  );
}
