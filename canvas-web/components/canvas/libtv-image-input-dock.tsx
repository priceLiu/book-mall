"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MentionsTextareaCommitHandle } from "@/components/canvas/mentions/MentionsTextarea";
import { LibtvDockCreditsLabel } from "./libtv-dock-credits-label";
import { useNodes } from "@xyflow/react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { batchRunStoryRows } from "@/lib/canvas/batch-run-nodes";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  resolvePro2DockUpstreamLinks,
  resolvePro2DockStyleFromUpstream,
  pro2DockStyleShownAsChip,
  pro2DockUpstreamLinksForChips,
} from "@/lib/canvas/pro2-dock-upstream-links";
import { pro2DockRefImageCatalog } from "@/lib/canvas/pro2-dock-ref-catalog";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { pickDefaultSbv1ImageEngine, resolveDockImageEnginePick } from "@/lib/canvas/sbv1-image-models";
import {
  canvasImageEditModelLabel,
  canvasImageEditRequiresRefs,
} from "@/lib/canvas/canvas-image-edit-models";
import {
  pickDefaultPro2FrameImageEngine,
  PRO2_FRAME_IMAGE_MODEL_KEYS,
} from "@/lib/canvas/pro2-frame-batch-image";
import { pro2BatchImageToImageNodePatch } from "@/lib/canvas/pro2-three-view-engine";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import {
  isLibtvFreestandingImageNode,
  isLibtvPipelineImageCell,
  isOrphanLibtvMediaInflight,
  optimisticLibtvMediaRunStart,
  revertOptimisticLibtvMediaRunStart,
} from "@/lib/canvas/libtv-image-node-run";
import { clearCanvasNodeRunSession } from "@/lib/canvas/canvas-run-session";
import {
  resolveLibtvSoleSelectedNodeId,
  useLibtvShouldSuppressFloatingDock,
} from "@/lib/canvas/libtv-floating-dock-selection";
import {
  isLibtvPro2ImageDockNodeType,
  LIBTV_PRO2_IMAGE_DOCK_NODE_TYPES,
} from "@/lib/canvas/libtv-pro2-image-dock-types";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";
import type { StoryPro2ImageNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { isLibtvMediaGenerating } from "@/components/canvas/libtv-media-generating-state";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import {
  normalizeModelKey,
  useModelCreditsPreview,
} from "@/lib/canvas/use-model-credits-preview";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import { LibtvDockSendButton } from "./libtv-dock-send-button";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { pro2ImageNodeUsesEmbeddedDock } from "./pro2/pro2-image-node-embedded-dock";
import { Pro2DockPasteZone } from "./pro2/pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2/pro2-dock-ref-images";
import { Pro2DockStyleButton } from "./pro2/pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "./pro2/pro2-dock-upstream-chips";
import { Pro2DockUpstreamHeader } from "./pro2/pro2-dock-upstream-header";
import { Pro2VisualStylePackBar } from "./pro2/pro2-visual-style-pack-bar";
import { promptHasEmbeddedVisualStyleBlock } from "@/lib/canvas/story-pro-visual-style-pack";
import {
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2/pro2-input-dock-shell";
import { sbv1ImageNodeUsesEmbeddedDock } from "./sbv1/sbv1-image-node-embedded-dock";
import {
  Sbv1ImageDockModelPicker,
  Sbv1ImageDockParamsPicker,
} from "./sbv1/sbv1-image-dock-pickers";

type DockImageNodeType =
  | "sbv1-image"
  | "story-pro2-image"
  | "story-pro2-prop"
  | "story-pro2-mood";

function placeholderDockLabel(type: string | undefined): string | undefined {
  if (type === "story-pro2-prop") return "描述道具外观与材质；输入 @ 引用风格或场景…";
  if (type === "story-pro2-mood") return "描述氛围、光线与情绪；输入 @ 引用风格…";
  return undefined;
}

function resolveSceneEngineFromHub(
  hubNodeId: string | undefined,
  nodes: CanvasFlowNode[],
): { providerId: string; modelKey: string; params?: Record<string, unknown> } | null {
  if (!hubNodeId?.trim()) return null;
  const hub = nodes.find((n) => n.id === hubNodeId);
  const batch = (
    hub?.data as {
      sceneBatchImage?: {
        providerId?: string;
        modelKey?: string;
        params?: Record<string, unknown>;
      };
    }
  )?.sceneBatchImage;
  if (!batch?.providerId?.trim() || !batch.modelKey?.trim()) return null;
  return {
    providerId: batch.providerId,
    modelKey: batch.modelKey,
    params: batch.params ?? {},
  };
}

function framePromptPlaceholder(role?: string): string {
  if (role === "frame") {
    return "编辑本镜 AI 生图提示词；输入 @ 引用角色三视图或风格参考…";
  }
  if (role === "scene") {
    return "编辑场景生图关键词；输入 @ 引用风格或上游图片…";
  }
  if (role === "prop") {
    return "编辑道具生图关键词；输入 @ 引用风格或场景…";
  }
  if (role === "mood") {
    return "编辑氛围生图关键词；输入 @ 引用风格…";
  }
  return "可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜";
}

/** LibTV 统一图片节点 · 底部浮动输入坞（分镜 1.0 · 影视专业 2.0） */
export function LibtvImageInputDock() {
  const rfNodes = useNodes();
  const suppressDock = useLibtvShouldSuppressFloatingDock();
  const pinnedId = useCanvasStore((s) => s.libtvFloatingDockNodeId);
  const pinnedType = useCanvasStore((s) => s.libtvFloatingDockNodeType);
  const pinned = useMemo(
    () => ({ nodeId: pinnedId, nodeType: pinnedType }),
    [pinnedId, pinnedType],
  );

  const sbv1DockNodeId = useLibtvSoleSelectedNodeId("sbv1-image");
  const pro2DockNodeId = useMemo(() => {
    if (suppressDock) return null;
    for (const nodeType of LIBTV_PRO2_IMAGE_DOCK_NODE_TYPES) {
      const id = resolveLibtvSoleSelectedNodeId(rfNodes, nodeType, pinned);
      if (!id) continue;
      if (nodeType === "story-pro2-image") {
        const rf = rfNodes.find((n) => n.id === id);
        if (
          (rf?.data as { pro2MediaRole?: string })?.pro2MediaRole ===
          "character-three-view"
        ) {
          continue;
        }
      }
      return id;
    }
    return null;
  }, [rfNodes, suppressDock, pinned]);

  const dockNodeId = sbv1DockNodeId ?? pro2DockNodeId;
  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

  if (suppressDock || !dockNodeId || !dockActive || !placement) return null;

  return (
    <LibtvImageInputDockBody
      key={dockNodeId}
      dockNodeId={dockNodeId}
      placement={placement}
      dockHidden={dockHidden}
    />
  );
}

function LibtvImageInputDockBody({
  dockNodeId,
  placement,
  dockHidden,
}: {
  dockNodeId: string;
  placement: LibtvDockFlowPlacement;
  dockHidden: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);
  const promptCommitRef = useRef<MentionsTextareaCommitHandle | null>(null);

  const storeNode = useMemo(() => {
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);

  const nodeType = (storeNode?.type ?? "sbv1-image") as DockImageNodeType;
  const isPro2 = isLibtvPro2ImageDockNodeType(nodeType);
  const pro2Data = (storeNode?.data ?? {}) as StoryPro2ImageNodeData;
  const isPipelineCell = isLibtvPipelineImageCell(storeNode ?? undefined);
  const isFramePipelineCell =
    isPipelineCell && pro2Data.pro2MediaRole === "frame";
  const showModelPicker = !isPipelineCell || isFramePipelineCell;

  const framePipelineController = useMemo(() => {
    if (!isFramePipelineCell || !pro2Data.pro2ControllerNodeId) return null;
    return nodes.find((n) => n.id === pro2Data.pro2ControllerNodeId) ?? null;
  }, [isFramePipelineCell, pro2Data.pro2ControllerNodeId, nodes]);

  const frameBatchImage = (
    framePipelineController?.data as
      | {
          batchImage?: {
            providerId?: string;
            modelKey?: string;
            params?: Record<string, unknown>;
          };
        }
      | undefined
  )?.batchImage;

  const settingsData = (storeNode?.data ?? {}) as Sbv1ImageNodeData;
  const dockInput = settingsData.dockInput ?? "";
  const [livePrompt, setLivePrompt] = useState(dockInput);
  useEffect(() => {
    setLivePrompt(dockInput);
  }, [dockInput, dockNodeId]);
  const dockRefImages = settingsData.dockRefImages ?? [];
  const previewUrl = settingsData.ossUrl ?? settingsData.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isRunning = isLibtvMediaGenerating(
    (storeNode?.data ?? {}) as { uploading?: boolean; runtime?: { status?: string } },
  );
  const orphanInflight = Boolean(
    storeNode &&
      isOrphanLibtvMediaInflight((storeNode.data ?? {}) as Sbv1ImageNodeData),
  );
  const freestandingBlocked = isRunning && !orphanInflight;

  const isFrameFreestanding =
    pro2Data.pro2MediaRole === "frame" && !isPipelineCell;

  const engine = isFramePipelineCell
    ? frameBatchImage?.providerId && frameBatchImage?.modelKey
      ? {
          providerId: frameBatchImage.providerId,
          modelKey: frameBatchImage.modelKey,
          params: frameBatchImage.params,
        }
      : undefined
    : settingsData.engine;
  const modelKey = normalizeModelKey(engine?.modelKey);
  const resolvedEngine = useMemo(() => {
    if (isFramePipelineCell && frameBatchImage?.providerId) {
      return {
        providerId: frameBatchImage.providerId,
        modelKey: frameBatchImage.modelKey ?? "",
        params: frameBatchImage.params ?? {},
      };
    }
    return resolveDockImageEnginePick(settingsData.engine, providers, () =>
      isFrameFreestanding || pro2Data.pro2MediaRole === "frame"
        ? pickDefaultPro2FrameImageEngine(providers)
        : pickDefaultSbv1ImageEngine(providers),
    );
  }, [
    isFramePipelineCell,
    frameBatchImage,
    settingsData.engine,
    providers,
    isFrameFreestanding,
    pro2Data.pro2MediaRole,
  ]);
  const hasEngine = Boolean(
    resolvedEngine?.providerId?.trim() &&
      normalizeModelKey(resolvedEngine.modelKey),
  );
  const outputCount = settingsData.outputCount ?? 1;
  const pickerData = useMemo((): Sbv1ImageNodeData => {
    if (!isFramePipelineCell || !frameBatchImage?.providerId) {
      return settingsData;
    }
    return {
      ...settingsData,
      engine: {
        providerId: frameBatchImage.providerId,
        modelKey: frameBatchImage.modelKey ?? "",
        params: frameBatchImage.params ?? {},
      },
    };
  }, [isFramePipelineCell, frameBatchImage, settingsData]);
  const estCredits = useModelCreditsPreview(
    modelKey,
    0,
    undefined,
    outputCount,
    settingsData.resolution ?? "2K",
  );

  const showVisualStylePackBar =
    isPro2 &&
    Boolean(pro2Data.pro2HubNodeId) &&
    !isPipelineCell &&
    pro2Data.pro2MediaRole !== "scene" &&
    !promptHasEmbeddedVisualStyleBlock(dockInput);
  const imageModelKeys =
    isFrameFreestanding || pro2Data.pro2MediaRole === "frame"
      ? PRO2_FRAME_IMAGE_MODEL_KEYS
      : undefined;

  useEffect(() => {
    if (!storeNode || !showModelPicker || engine?.providerId?.trim()) return;
    if (pro2Data.pro2MediaRole === "scene") {
      const fromHub = resolveSceneEngineFromHub(pro2Data.pro2HubNodeId, nodes);
      if (fromHub) {
        updateNodeData(storeNode.id, pro2BatchImageToImageNodePatch(fromHub));
        return;
      }
    }
    const seed = resolveDockImageEnginePick(settingsData.engine, providers, () =>
      isFrameFreestanding || pro2Data.pro2MediaRole === "frame"
        ? pickDefaultPro2FrameImageEngine(providers)
        : pickDefaultSbv1ImageEngine(providers),
    );
    if (!seed) return;
    if (isFramePipelineCell && framePipelineController) {
      updateNodeData(framePipelineController.id, { batchImage: seed });
      return;
    }
    updateNodeData(storeNode.id, { engine: seed });
  }, [
    storeNode,
    showModelPicker,
    engine?.providerId,
    providers,
    updateNodeData,
    isFrameFreestanding,
    pro2Data.pro2MediaRole,
    pro2Data.pro2HubNodeId,
    nodes,
    isFramePipelineCell,
    framePipelineController,
  ]);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      nodeType,
      nodes,
      edges,
    );
  }, [storeNode, nodeType, nodes, edges]);

  const dockStyleRef = settingsData.dockStyleRef ?? pro2Data.dockStyleRef;
  const chipLinks = useMemo(
    () => pro2DockUpstreamLinksForChips(upstreamLinks),
    [upstreamLinks],
  );
  const showStyleButton = !pro2DockStyleShownAsChip(
    upstreamLinks,
    dockStyleRef,
  );

  const mentionables = useMemo(
    () => buildPro2DockMentionables(upstreamLinks, dockRefImages),
    [upstreamLinks, dockRefImages],
  );
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(dockInput),
    [dockInput],
  );

  usePruneStaleDockMentions({
    nodeId: storeNode?.id ?? null,
    prompt: dockInput,
    mentionables,
    field: "dockInput",
    updateNodeData,
  });

  const syncFrameRowPrompt = useCallback(
    (value: string) => {
      if (!storeNode || pro2Data.pro2MediaRole !== "frame") return;
      const controllerId = pro2Data.pro2ControllerNodeId;
      const rowKey = pro2Data.pro2RowKey;
      if (!controllerId || !rowKey) return;
      const controller = nodes.find((n) => n.id === controllerId);
      if (!controller) return;
      const rows = (controller.data as { rows?: StoryProFrameRow[] }).rows ?? [];
      const refImages = pro2DockRefImageCatalog(upstreamLinks);
      updateNodeData(controllerId, {
        rows: rows.map((r) =>
          r.key === rowKey ? { ...r, prompt: value, refImages } : r,
        ),
      });
    },
    [
      storeNode,
      pro2Data.pro2MediaRole,
      pro2Data.pro2ControllerNodeId,
      pro2Data.pro2RowKey,
      nodes,
      updateNodeData,
      upstreamLinks,
    ],
  );

  const onPromptChange = useCallback(
    (value: string, _refs?: string[], meta?: { commit?: boolean }) => {
      if (!storeNode) return;
      setLivePrompt(value);
      updateNodeData(
        storeNode.id,
        { dockInput: value },
        { commit: meta?.commit ?? true },
      );
      if (meta?.commit !== false) {
        syncFrameRowPrompt(value);
      }
    },
    [storeNode, updateNodeData, syncFrameRowPrompt],
  );

  const onOpenStyleLibrary = useCallback(() => {
    if (!storeNode) return;
    setPro2StyleLibImageNodeId(storeNode.id);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [storeNode, setPro2StyleLibImageNodeId]);

  const onRunPipeline = useCallback(() => {
    if (!storeNode || !isPipelineCell) return;
    const controllerId = pro2Data.pro2ControllerNodeId;
    const rowKey = pro2Data.pro2RowKey;
    if (!controllerId || !rowKey || pro2Data.pro2MediaRole !== "frame") return;
    optimisticLibtvMediaRunStart(storeNode.id, updateNodeData, setNodeRuntime);
    batchRunStoryRows(controllerId, [rowKey], "frameImage", {
      forceFresh: true,
    });
  }, [storeNode, isPipelineCell, pro2Data, updateNodeData, setNodeRuntime]);

  const onRunFreestanding = useCallback(async () => {
    if (!storeNode || !isLibtvFreestandingImageNode(storeNode)) return;

    const nodeData = (storeNode.data ?? {}) as Sbv1ImageNodeData;
    const orphanInflight = isOrphanLibtvMediaInflight(nodeData);
    if (isRunning && !orphanInflight) return;
    if (orphanInflight) {
      clearCanvasNodeRunSession(storeNode.id);
      revertOptimisticLibtvMediaRunStart(
        storeNode.id,
        updateNodeData,
        setNodeRuntime,
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const { nodes: latestNodes, edges: latestEdges } = useCanvasStore.getState();
    const latestNode = latestNodes.find((n) => n.id === storeNode.id);
    const latestData = (latestNode?.data ?? {}) as Sbv1ImageNodeData;

    let runEngine = resolveDockImageEnginePick(latestData.engine, providers, () =>
      pro2Data.pro2MediaRole === "frame"
        ? pickDefaultPro2FrameImageEngine(providers)
        : pickDefaultSbv1ImageEngine(providers),
    );
    if (!runEngine?.providerId?.trim()) {
      if (pro2Data.pro2MediaRole === "scene") {
        const fromHub = resolveSceneEngineFromHub(pro2Data.pro2HubNodeId, latestNodes);
        if (fromHub) {
          runEngine = fromHub;
          updateNodeData(storeNode.id, pro2BatchImageToImageNodePatch(fromHub));
        }
      }
    }
    if (!runEngine?.providerId?.trim() || !normalizeModelKey(runEngine.modelKey)) {
      await alert({
        title: "请选择模型",
        message:
          "请先在「图片生成设置」中选择 KIE 生图模型（nano-banana-pro），并确认 Gateway 已绑定 KIE 凭证。",
        variant: "warning",
      });
      return;
    }
    if (!latestData.engine?.providerId?.trim()) {
      updateNodeData(storeNode.id, { engine: runEngine });
    }

    const latestUpstreamLinks = resolvePro2DockUpstreamLinks(
      storeNode.id,
      nodeType,
      latestNodes,
      latestEdges,
    );
    const prompt = String(latestData.dockInput ?? livePrompt).trim();
    const linkedStyle = resolvePro2DockStyleFromUpstream(latestUpstreamLinks);
    const latestPreviewUrl =
      latestData.ossUrl ?? latestData.blobUrl ?? "";
    const hasRefs =
      Boolean(latestPreviewUrl) ||
      latestUpstreamLinks.some((l) => l.previewUrl) ||
      Boolean(latestData.dockStyleRef?.imageUrl) ||
      Boolean(linkedStyle);
    if (!prompt && !hasRefs) {
      await alert({
        title: "请输入提示词",
        message: "可直接文字生图，或上传/连接图片后输入编辑指令。",
        variant: "warning",
      });
      return;
    }
    const editModelKey = normalizeModelKey(runEngine.modelKey);
    if (
      canvasImageEditRequiresRefs(editModelKey, {
        imageMode: String(latestData.imageMode ?? ""),
      }) &&
      !hasRefs
    ) {
      await alert({
        title: "需要参考图",
        message: `${canvasImageEditModelLabel(editModelKey)} 须连接上游图片或上传参考图后再生成。`,
        variant: "warning",
      });
      return;
    }
    if (!base) {
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }

    const queued = busEnqueueStoryRun({ nodeId: storeNode.id, forceFresh: true });
    if (!queued) {
      await alert({
        title: "无法开始生成",
        message: "该节点已有进行中的生成任务，请稍候完成后再试。",
        variant: "warning",
      });
    }
  }, [
    storeNode,
    providers,
    pro2Data.pro2MediaRole,
    pro2Data.pro2HubNodeId,
    updateNodeData,
    setNodeRuntime,
    livePrompt,
    nodeType,
    base,
    alert,
    isRunning,
  ]);

  const runWithCommittedPrompt = useCallback(() => {
    promptCommitRef.current?.flushDraft();
    void onRunFreestanding();
  }, [onRunFreestanding]);

  const onRun = isPipelineCell ? onRunPipeline : runWithCommittedPrompt;

  const onImagePatch = useCallback(
    (patch: Partial<Sbv1ImageNodeData>) => {
      if (!storeNode) return;
      if (isFramePipelineCell && framePipelineController) {
        const merged = { ...pickerData, ...patch };
        const nextEngine = merged.engine;
        if (nextEngine?.providerId && nextEngine.modelKey) {
          updateNodeData(framePipelineController.id, {
            batchImage: {
              providerId: nextEngine.providerId,
              modelKey: nextEngine.modelKey,
              params: nextEngine.params ?? {},
            },
          });
        }
        if (
          patch.aspectRatio !== undefined ||
          patch.resolution !== undefined ||
          patch.outputCount !== undefined ||
          patch.imageQuality !== undefined
        ) {
          updateNodeData(storeNode.id, {
            aspectRatio: merged.aspectRatio,
            resolution: merged.resolution,
            outputCount: merged.outputCount,
            imageQuality: merged.imageQuality,
          });
        }
        return;
      }
      updateNodeData(storeNode.id, patch);
    },
    [
      storeNode,
      isFramePipelineCell,
      framePipelineController,
      pickerData,
      updateNodeData,
    ],
  );

  if (!storeNode) return null;

  const usesEmbedded =
    nodeType === "sbv1-image"
      ? sbv1ImageNodeUsesEmbeddedDock(settingsData, {
          selected: true,
          soleSelected: true,
        })
      : pro2ImageNodeUsesEmbeddedDock(pro2Data, {
          selected: true,
          soleSelected: true,
        });
  if (usesEmbedded) return null;

  const styleRef = dockStyleRef;
  const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
  const styleActive = Boolean(styleRef || linkedStyle);
  const styleLabel = styleRef?.name ?? linkedStyle?.name;

  const canSendPipeline =
    isPipelineCell &&
    Boolean(pro2Data.pro2ControllerNodeId && pro2Data.pro2RowKey) &&
    !isRunning &&
    (Boolean(livePrompt.trim()) || hasImage) &&
    (isFramePipelineCell ? hasEngine : true);

  const canSendFreestanding =
    showModelPicker &&
    hasEngine &&
    !freestandingBlocked &&
    (Boolean(livePrompt.trim()) ||
      hasImage ||
      upstreamLinks.some((l) => l.previewUrl) ||
      Boolean(styleRef?.imageUrl) ||
      Boolean(linkedStyle));

  const canSend = isPipelineCell ? canSendPipeline : canSendFreestanding;

  const placeholder = hasImage
    ? "输入文字指令对图片进行编辑，如：将背景改为雪夜"
    : placeholderDockLabel(nodeType) ??
      framePromptPlaceholder(pro2Data.pro2MediaRole);

  const mentionEdition = nodeType === "sbv1-image" ? "sbv1" : "pro2";

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        dockClassName={isPro2 ? "pro2-image-dock" : "sbv1-image-dock"}
        hidden={dockHidden}
        anchorNodeId={storeNode.id}
        header={
          <Pro2DockUpstreamHeader
            refRow={
              chipLinks.length > 0 ? (
                <Pro2DockUpstreamChips
                  links={chipLinks}
                  anchorNodeId={storeNode.id}
                  activeIds={activeRefIds}
                />
              ) : null
            }
            actionRow={
              <>
                {showStyleButton ? (
                  <Pro2DockStyleButton
                    active={styleActive}
                    label={styleLabel}
                    disabled={isRunning}
                    onClick={onOpenStyleLibrary}
                  />
                ) : null}
                <Pro2DockRefImages
                  refs={dockRefImages}
                  onChange={(next) =>
                    updateNodeData(storeNode.id, { dockRefImages: next })
                  }
                  promptValue={dockInput}
                  onPromptChange={onPromptChange}
                  disabled={isRunning}
                  pasteActive={false}
                  activeIds={activeRefIds}
                  spawnAnchor={{
                    nodeId: storeNode.id,
                    nodeType,
                  }}
                  maxCount={12}
                />
              </>
            }
          />
        }
        footer={
          <LibtvImageDockFooter
            isPipelineCell={isPipelineCell && !isFramePipelineCell}
            isRunning={isRunning}
            showModelPicker={showModelPicker || isFramePipelineCell}
            pickerData={pickerData}
            imageModelKeys={imageModelKeys}
            dockMenu={dockMenu}
            onDockMenuChange={setDockMenu}
            onImagePatch={onImagePatch}
            estCredits={estCredits}
            canSend={canSend}
            onRun={onRun}
          />
        }
      >
        <Pro2DockPasteZone
          anchorNodeId={storeNode.id}
          anchorNodeType={nodeType}
          disabled={isRunning}
          maxImages={12}
        >
          {showVisualStylePackBar ? (
            <Pro2VisualStylePackBar hubNodeId={pro2Data.pro2HubNodeId} />
          ) : null}
          <MentionsEditable
            key={storeNode.id}
            sourceId={storeNode.id}
            commitHandleRef={promptCommitRef}
            className={cn(
              PRO2_DOCK_TEXTAREA_CLASS,
              RF_FORM_CONTROL,
              RF_NO_WHEEL,
              PRO2_DOCK_TEXTAREA_INSET_CLASS,
            )}
            placeholder={placeholder}
            value={dockInput}
            mentionables={mentionables}
            disabled={isRunning}
            rows={3}
            mentionInlineThumb
            mentionInlineThumbHoverOnText
            mentionEdition={mentionEdition}
            onChange={onPromptChange}
          />
        </Pro2DockPasteZone>
      </Pro2InputDockShell>
    </>
  );
}

function LibtvImageDockFooter({
  isPipelineCell,
  isRunning,
  showModelPicker,
  pickerData,
  imageModelKeys,
  dockMenu,
  onDockMenuChange,
  onImagePatch,
  estCredits,
  canSend,
  onRun,
}: {
  isPipelineCell: boolean;
  isRunning: boolean;
  showModelPicker: boolean;
  pickerData: Sbv1ImageNodeData;
  imageModelKeys?: readonly string[];
  dockMenu: "model" | "params" | null;
  onDockMenuChange: (menu: "model" | "params" | null) => void;
  onImagePatch: (patch: Partial<Sbv1ImageNodeData>) => void;
  estCredits: ReturnType<typeof useModelCreditsPreview>;
  canSend: boolean;
  onRun: () => void;
}) {
  const { fontPx, sendIconPx } = useLibtvDockToolbarMetrics();

  return (
    <Pro2DockToolbar className="gap-2">
      {showModelPicker && !isPipelineCell ? (
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-0.5">
          <Sbv1ImageDockModelPicker
            data={pickerData}
            allowedModelKeys={imageModelKeys}
            disabled={isRunning}
            open={dockMenu === "model"}
            onOpenChange={(next) => onDockMenuChange(next ? "model" : null)}
            onPatch={onImagePatch}
          />
          <Sbv1ImageDockParamsPicker
            data={pickerData}
            disabled={isRunning}
            open={dockMenu === "params"}
            onOpenChange={(next) => onDockMenuChange(next ? "params" : null)}
            onPatch={onImagePatch}
          />
        </div>
      ) : isPipelineCell ? (
        <div className="min-w-0 flex-1" />
      ) : null}
      <div className="flex shrink-0 items-center gap-1.5">
        <LibtvDockCreditsLabel
          credits={estCredits?.credits}
          fontPx={fontPx}
          title={
            estCredits?.credits != null
              ? `${estCredits.canonicalModelKey} · 挂牌 ${estCredits.creditsPerUnit} 积分/${estCredits.unit === "PER_IMAGE" ? "张" : "次"}`
              : undefined
          }
        />
        <LibtvDockSendButton
          disabled={!canSend}
          loading={isRunning}
          title={
            isRunning
              ? "生成中"
              : isPipelineCell
                ? "重新生成"
                : "生成图片"
          }
          onClick={onRun}
        />
      </div>
    </Pro2DockToolbar>
  );
}

/** @deprecated 使用 LibtvImageInputDock */
export const Sbv1ImageInputDock = LibtvImageInputDock;

/** @deprecated 使用 LibtvImageInputDock */
export const Pro2ImageInputDock = LibtvImageInputDock;
