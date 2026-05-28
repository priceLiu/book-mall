"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  THREE_VIEW_ENGINE_MODEL_KEYS,
  STORY_PRO_FRAME_IMAGE_MODEL_KEYS,
  STORY_PRO_FRAME_IMAGE_SINGLE_REF_MODEL_KEYS,
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
import { buildAssetRefsByCharacterKey } from "@/lib/canvas/story-pro-character-asset-catalog";
import { useStoryProCharacterAssets } from "@/lib/canvas/use-story-pro-character-assets";
import {
  buildAssetRefsBySceneKey,
  mergeFrameRefCatalog,
} from "@/lib/canvas/story-pro-scene-asset-catalog";
import { useStoryProSceneAssets } from "@/lib/canvas/use-story-pro-scene-assets";
import {
  assessFrameRowAssetReadiness,
  buildCharacterRefSnapshot,
} from "@/lib/canvas/story-pro-asset-readiness";
import {
  applyFrameRefSuggestionsToPrompt,
  suggestFrameRefsForRow,
} from "@/lib/canvas/story-pro-frame-ref-suggest";
import {
  StoryProFrameAssetReadinessBar,
  StoryProFrameRefSuggestBar,
  frameRowStaleSnapshot,
} from "../story-pro-frame-row-extras";
import type {
  StoryCharacterColumnNodeData,
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "@/lib/canvas/story-workspace-types";
import type {
  StoryProStyleNodeData,
  StoryProSceneColumnNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import {
  isStoryFrameApproved,
  storyVideoGenerateBlockReason,
} from "@/lib/canvas/story-frame-gate";
import { modelHasStoryCapabilities } from "@/lib/canvas/story-model-capabilities";
import {
  storyEditionAccent,
  storyEditionFromNodeType,
} from "@/lib/canvas/story-edition-chrome";
import {
  PRO_HINT_LABEL_CLASS,
  PRO_NODE_SHELL_FOOTER_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import { STORY_HINT_LABEL_CLASS, STORY_HINT_BODY_CLASS, FRAME_ROW_AT_HINT, stripFrameRowAtHint, sanitizeLegacyFramePrompt, patchVideoRowsFromFrameRows } from "@/lib/canvas/story-column-sync";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import {
  storyFrameColumnSize,
  storyFrameVideoRowBlockH,
  STORY_MEDIA_ROW_GAP,
} from "@/lib/canvas/story-column-layout";
import { StoryEnginePickerStack } from "../story-engine-picker-stack";
import { StoryFrameVideoEnginePanel } from "../story-frame-video-engine-panel";
import { StoryColumnBatchFooter } from "../story-column-batch-footer";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryColumnRowCard } from "../story-row-prompt-field";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryImageEngine } from "@/lib/canvas/system-providers";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import type { StoryProWorkspaceIds } from "@/lib/canvas/story-pro-workspace-types";

export function StoryFrameColumnNode({ id, data, selected, type }: NodeProps) {
  const edition = storyEditionFromNodeType(type);
  const hintLabelClass =
    edition === "pro" ? PRO_HINT_LABEL_CLASS : STORY_HINT_LABEL_CLASS;
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const d = data as unknown as StoryFrameColumnNodeData;
  const stored = d.rows ?? [];
  const batchImage = d.batchImage;
  const injectStyleRefs = d.injectStyleRefs === true;
  const { providers } = useUserProviders();
  const { alert, confirm, prompt } = useDialogs();
  const { assets: projectCharacterAssets } = useStoryProCharacterAssets(
    edition === "pro" ? projectId : null,
  );
  const { assets: projectSceneAssets } = useStoryProSceneAssets(
    edition === "pro" ? projectId : null,
  );

  const canGenerateFrame = Boolean(
    batchImage?.providerId?.trim() && batchImage?.modelKey?.trim(),
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

  const resolvedBatchVideo = useMemo((): CanvasEnginePick | undefined => {
    if (videoColumnId) {
      const vd = nodes.find((n) => n.id === videoColumnId)?.data as
        | StoryVideoColumnNodeData
        | undefined;
      if (vd?.batchVideo?.providerId?.trim()) return vd.batchVideo;
    }
    const legacy = d.batchVideo ?? batchImage;
    return legacy?.providerId?.trim() ? legacy : undefined;
  }, [videoColumnId, nodes, d.batchVideo, batchImage]);

  const canGenerateVideo = Boolean(
    resolvedBatchVideo?.providerId?.trim() &&
      resolvedBatchVideo?.modelKey?.trim(),
  );

  const proWorkspaceIds = useMemo((): StoryProWorkspaceIds | null => {
    if (edition !== "pro") return null;
    const col = nodes.find((n) => n.id === id);
    const hubNodeId = (col?.data as { hubNodeId?: string }).hubNodeId;
    if (!hubNodeId) return null;
    const starter = resolveStarterForHub(nodes, edges, hubNodeId);
    return (
      (starter?.data as { workspaceIds?: StoryProWorkspaceIds }).workspaceIds ??
      null
    );
  }, [edition, nodes, edges, id]);

  const characterRows = useMemo(() => {
    const charColId = proWorkspaceIds?.characterColumnId ?? ws?.characterColumnId;
    if (!charColId) return [];
    const charNode = nodes.find((n) => n.id === charColId);
    const storedChar =
      (charNode?.data as { rows?: Parameters<typeof displayCharacterRows>[2] })
        ?.rows ?? [];
    const synced = displayCharacterRows(nodes, charColId, storedChar);
    return synced.map((row) => {
      const prev = storedChar.find(
        (r) => r.key === row.key || r.name === row.name,
      );
      if (!prev) return row;
      return {
        ...row,
        runtime: prev.runtime ?? row.runtime,
        assetId: (prev as { assetId?: string }).assetId ?? (row as { assetId?: string }).assetId,
        lockedRefIds:
          (prev as { lockedRefIds?: string[] }).lockedRefIds ??
          (row as { lockedRefIds?: string[] }).lockedRefIds,
      };
    });
  }, [nodes, proWorkspaceIds?.characterColumnId, ws?.characterColumnId]);

  const assetRefsByKey = useMemo(
    () =>
      edition === "pro"
        ? buildAssetRefsByCharacterKey(
            projectCharacterAssets,
            characterRows,
            projectId,
          )
        : {},
    [edition, projectCharacterAssets, characterRows, projectId],
  );

  const characterCatalog = useMemo(
    () => storyCharacterRefCatalog(characterRows, assetRefsByKey),
    [characterRows, assetRefsByKey],
  );

  const sceneRows = useMemo(() => {
    const sceneColId = proWorkspaceIds?.sceneColumnId;
    if (edition !== "pro" || !sceneColId) return [];
    const sceneNode = nodes.find((n) => n.id === sceneColId);
    return (sceneNode?.data as StoryProSceneColumnNodeData | undefined)?.rows ?? [];
  }, [edition, nodes, proWorkspaceIds?.sceneColumnId]);

  const sceneAssetRefsByKey = useMemo(
    () =>
      edition === "pro"
        ? buildAssetRefsBySceneKey(projectSceneAssets, sceneRows, projectId)
        : {},
    [edition, projectSceneAssets, sceneRows, projectId],
  );

  const sceneCatalog = useMemo(() => {
    const out: ReturnType<typeof storyCharacterRefCatalog> = [];
    for (const refs of Object.values(sceneAssetRefsByKey)) {
      out.push(...refs);
    }
    return out;
  }, [sceneAssetRefsByKey]);

  const frameRefCatalog = useMemo(
    () => mergeFrameRefCatalog(characterCatalog, sceneCatalog),
    [characterCatalog, sceneCatalog],
  );

  const characterMentionables = useMemo(() => {
    if (edition === "pro" && frameRefCatalog.length) {
      return frameRefCatalog
        .filter((r) => r.url && /^https?:\/\//.test(r.url))
        .map((r) => ({
          id: r.id,
          label: r.label,
          kind: "image" as const,
          previewUrl: r.url,
        }));
    }
    return storyGeneratedCharacterMentionables(characterRows);
  }, [edition, frameRefCatalog, characterRows]);

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

  const targetSize = useMemo(
    () => storyFrameColumnSize(displayRows, { pro: edition === "pro" }),
    [displayRows, edition],
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

  const styleNodeId = useMemo(
    () => proWorkspaceIds?.styleNodeId,
    [proWorkspaceIds?.styleNodeId],
  );

  useEffect(() => {
    if (edition !== "pro" || !injectStyleRefs || !styleNodeId) return;
    const styleNode = nodes.find((n) => n.id === styleNodeId);
    const refs = (styleNode?.data as StoryProStyleNodeData | undefined)
      ?.refImages;
    const urls = (refs ?? [])
      .map((r: { url?: string }) => r.url)
      .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)))
      .slice(0, 2);
    const prev = d.styleRefImageUrls ?? [];
    if (prev.join("|") === urls.join("|")) return;
    updateNodeData(id, { styleRefImageUrls: urls });
  }, [
    edition,
    injectStyleRefs,
    styleNodeId,
    nodes,
    id,
    updateNodeData,
    d.styleRefImageUrls,
  ]);

  const updateRows = (next: typeof displayRows) => {
    updateNodeData(id, { rows: next });
  };

  const runRowVideo = async (key: string, frameUrl?: string) => {
    if (!videoColumnId || !canGenerateVideo || !resolvedBatchVideo) return;
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
          providerId: resolvedBatchVideo.providerId,
          modelKey: resolvedBatchVideo.modelKey,
          params: resolvedBatchVideo.params ?? {},
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

  const batchFillAtRefs = () => {
    if (edition !== "pro" || !displayRows.length) return;
    const next = displayRows.map((row) => {
      const suggestions = suggestFrameRefsForRow(
        row,
        characterRows,
        assetRefsByKey,
      );
      if (!suggestions.length) return row;
      const { prompt } = applyFrameRefSuggestionsToPrompt(
        stripFrameRowAtHint(row.prompt),
        suggestions,
      );
      const refImages = storyRefImagesFromPrompt(prompt, frameRefCatalog);
      const refImageUrls = refImages
        .map((ref) => ref.url)
        .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
      const refIds = refImages.map((r) => r.id);
      const snapshot = buildCharacterRefSnapshot(
        refIds,
        projectCharacterAssets,
        characterRows,
        projectId,
      );
      return {
        ...row,
        prompt: sanitizeLegacyFramePrompt(prompt.trim()) || prompt.trim(),
        refImages,
        refImageUrls,
        ...snapshot,
      };
    });
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
    const refImages = storyRefImagesFromPrompt(prompt, frameRefCatalog);
    const refImageUrls = refImages
      .map((ref) => ref.url)
      .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
    const snapshot =
      edition === "pro"
        ? buildCharacterRefSnapshot(
            refImages.map((r) => r.id),
            projectCharacterAssets,
            characterRows,
            projectId,
          )
        : {};
    const next = displayRows.map((r) =>
      r.key === key
        ? {
            ...r,
            prompt: sanitizeLegacyFramePrompt(prompt.trim()) || prompt.trim(),
            referencedNodeIds: referencedIds,
            refImages,
            refImageUrls,
            ...snapshot,
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

  const patchFrameRow = (
    key: string,
    patch: Partial<(typeof displayRows)[number]>,
  ) => {
    const next = displayRows.map((r) =>
      r.key === key ? { ...r, ...patch } : r,
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

  const approveFrameRow = (key: string) => {
    patchFrameRow(key, {
      frameApprovedAt: new Date().toISOString(),
      frameRejectedReason: undefined,
    });
  };

  const rejectFrameRow = async (key: string) => {
    const reason = await prompt({
      title: "驳回分镜图",
      message: "可选填写驳回原因，留空则使用默认文案。",
      label: "驳回原因",
      placeholder: "需重新生成分镜图",
      defaultValue: "",
      confirmLabel: "确认驳回",
      cancelLabel: "取消",
    });
    if (reason === null) return;
    patchFrameRow(key, {
      frameApprovedAt: undefined,
      frameRejectedReason: reason.trim() || "需重新生成分镜图",
    });
  };

  const frameImageModelKeys = useMemo(() => {
    if (edition !== "pro") return [...THREE_VIEW_ENGINE_MODEL_KEYS];
    const multi = [...STORY_PRO_FRAME_IMAGE_MODEL_KEYS];
    const single = STORY_PRO_FRAME_IMAGE_SINGLE_REF_MODEL_KEYS.filter((k) =>
      modelHasStoryCapabilities(k, ["image_t2i"]),
    );
    return [...multi, ...single];
  }, [edition]);

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
      disableGeneratingChrome
      accent={storyEditionAccent(edition)}
      minWidth={targetSize.width}
      minHeight={targetSize.height}
      inputs={[{ id: "in_text", label: "分镜脚本", kind: "text" }]}
      outputs={[{ id: "text", label: "分镜图", kind: "image" }]}
      footerClassName={
        edition === "pro" ? PRO_NODE_SHELL_FOOTER_CLASS : undefined
      }
      footer={
        <StoryNodeFooterShell>
          <div className="flex flex-col gap-1.5">
            {edition === "pro" ? (
              <button
                type="button"
                disabled={columnGenerating || !displayRows.length}
                className="nodrag h-8 w-full rounded-md border border-cyan-400/25 text-[11px] text-cyan-100/90 hover:bg-cyan-500/10 disabled:opacity-40"
                onClick={batchFillAtRefs}
              >
                为本列补齐 @ 角色
              </button>
            ) : null}
            <StoryColumnBatchFooter
              edition={edition}
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
          </div>
        </StoryNodeFooterShell>
      }
    >
      <div
        className="flex w-full flex-col"
        style={{ gap: STORY_MEDIA_ROW_GAP }}
      >
        <StoryFrameVideoEnginePanel
          row1={
            edition === "pro" ? (
              <label className="nodrag flex h-full cursor-pointer items-center gap-2 text-[11px] leading-tight text-cyan-200/80">
                <input
                  type="checkbox"
                  className="rounded border-cyan-400/40"
                  checked={injectStyleRefs}
                  onChange={(e) =>
                    updateNodeData(id, { injectStyleRefs: e.target.checked })
                  }
                />
                静帧生成时注入风格参考图（最多 2 张）
              </label>
            ) : (
              <p className="flex h-full items-center text-[10px] leading-tight text-white/25">
                分镜静帧
              </p>
            )
          }
          row2={
            edition === "pro" ? (
              <p
                className={`flex h-full items-center leading-tight ${STORY_HINT_BODY_CLASS}`}
              >
                {FRAME_ROW_AT_HINT}
              </p>
            ) : (
              <p className="flex h-full items-center text-[10px] text-white/20">
                —
              </p>
            )
          }
          row3={
            <StoryEnginePickerStack
              label={
                <>
                  分镜图 · IMAGE
                  {!canGenerateFrame ? (
                    <span className="ml-1 normal-case text-amber-300/90">
                      · 请先选择生图模型
                    </span>
                  ) : null}
                </>
              }
              labelClassName={hintLabelClass}
            >
              <EnginePicker
                role="IMAGE"
                allowedModelKeys={frameImageModelKeys}
                capabilityHint="分镜含 @ 多角色参考时，请选 nano-banana-pro / flux-2-pro / seedream / gpt-image 等 multi_ref 模型；无 @ 时可用 qwen"
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
            </StoryEnginePickerStack>
          }
        />
        <div
          className="flex w-full flex-col"
          style={{ gap: STORY_MEDIA_ROW_GAP }}
        >
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
                frameRefCatalog,
              );
              const suggestions =
                edition === "pro"
                  ? suggestFrameRefsForRow(row, characterRows, assetRefsByKey)
                  : [];
              const readiness =
                edition === "pro"
                  ? assessFrameRowAssetReadiness(
                      row,
                      characterRows,
                      projectCharacterAssets,
                      projectId,
                      assetRefsByKey,
                    )
                  : { level: "none" as const, characters: [] };
              const stale =
                edition === "pro" &&
                frameRowStaleSnapshot(row, projectCharacterAssets, projectId);
              const videoBlockReason = storyVideoGenerateBlockReason(row);
              return (
                <StoryColumnRowCard
                  key={row.key}
                  edition={edition}
                  rowTitle={`镜 ${row.frameIndex}`}
                  promptValue={stripFrameRowAtHint(row.prompt)}
                  compactFrameLayout
                  rowBlockMinHeight={storyFrameVideoRowBlockH({
                    pro: edition === "pro",
                  })}
                  belowPrompt={
                    edition === "pro" ? (
                      <div className="space-y-1">
                        <StoryProFrameRefSuggestBar
                          suggestions={suggestions}
                          currentPrompt={stripFrameRowAtHint(row.prompt)}
                          onApply={(p) => saveRowPrompt(row.key, p, [])}
                        />
                        <StoryProFrameAssetReadinessBar
                          readiness={readiness}
                          stale={stale}
                        />
                      </div>
                    ) : undefined
                  }
                  showUpstream
                  upstreamImages={upstreamImages}
                  mentionables={characterMentionables}
                  onSavePrompt={(p, refs) => saveRowPrompt(row.key, p, refs)}
                  mediaMode="frame"
                  imageUrl={frameUrl}
                  generating={frameRunning || videoRunning}
                  generateDisabled={!canGenerateFrame}
                  frameApproved={isStoryFrameApproved(row)}
                  frameRejectedReason={row.frameRejectedReason}
                  videoBlockReason={videoBlockReason}
                  onApproveFrame={
                    frameUrl ? () => approveFrameRow(row.key) : undefined
                  }
                  onRejectFrame={
                    frameUrl ? () => rejectFrameRow(row.key) : undefined
                  }
                  onGenerate={() => runRowFrame(row.key, Boolean(frameUrl))}
                  onGenerateVideo={
                    frameUrl &&
                    canGenerateVideo &&
                    videoColumnId &&
                    isStoryFrameApproved(row)
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
                  onPreviewRef={(url, title) => setPreview({ url, title })}
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
