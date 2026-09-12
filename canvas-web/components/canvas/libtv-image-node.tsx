"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { usePointerImagePasteHost } from "@/lib/canvas/image-upload-handlers";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useNodes, useReactFlow } from "@xyflow/react";
import { AlertTriangle, GripVertical, ImageIcon } from "lucide-react";
import { CanvasSaveToPoseLibraryButton } from "@/components/admin/canvas-save-to-pose-library-button";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { confirmOpenTopupCheckout } from "@/lib/platform-billing/open-topup-checkout";
import { scheduleCanvasImageUpload } from "@/lib/canvas/canvas-image-preview-upload";
import { useCanvasStore } from "@/lib/canvas/store";
import { CANVAS_SEMANTIC_STATUS_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_MEDIA_CARD_SHELL_CLASS,
  LIBTV_MEDIA_STAGE_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import {
  isSameSbv1MediaDataPatch,
  sbv1ImagePatchFromTask,
} from "@/lib/canvas/sbv1-image-task-apply";
import {
  pickActiveServerInflightTask,
  shouldApplyCanvasTaskRuntimePatch,
  shouldSkipStoryRowTaskApply,
} from "@/lib/canvas/task-pick";
import { pickTaskImagePreviewUrl } from "@/lib/canvas/task-media-url";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import type { CanvasEnginePick, CanvasNodeRuntime } from "@/lib/canvas/types";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { Pro2ImageMediaRole } from "@/lib/canvas/story-pro2-workspace-types";
import type { CanvasPortraitNodeFields } from "@/lib/canvas/portrait-node-data";
import { isPortraitNodeActive } from "@/lib/canvas/portrait-node-data";
import { useImportPortraitToLibrary } from "@/lib/canvas/use-import-portrait-to-library";
import {
  libtvMediaPreviewCanFallbackToBlob,
  libtvMediaPreviewCanFallbackToEphemeral,
  resolveLibtvMediaPreviewUrl,
} from "@/lib/canvas/libtv-media-preview-url";
import { Sbv1PortraitLivenessModal } from "./sbv1/sbv1-portrait-liveness-modal";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { GlobalAssetCatalogBadge } from "@/docker-shared/global-asset-library";
import { useSaveToCatalog } from "@/lib/use-save-to-catalog";
import { selectLibtvNodeAfterDuplicate } from "@/lib/canvas/select-libtv-node";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import {
  computeLibtvMediaNodeSize,
  isLibtvMediaNodeBoxStale,
  useLibtvMediaNodeAutoFit,
} from "@/lib/canvas/libtv-media-node-auto-fit";
import {
  fitLibtvUploadedImageNaturalSize,
  useLibtvMediaAspectPresetSync,
} from "@/lib/canvas/libtv-media-aspect-preset-apply";
import { shouldSkipLibtvImageNodeNaturalSizeAutoFit } from "@/lib/canvas/libtv-media-aspect-preset";
import { LIBTV_MEDIA_FIT_VERSION } from "@/lib/canvas/libtv-node-chrome";
import { PRO2_TEXT_NODE_TITLE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { cn } from "@/lib/utils";
import { MediaHoverBox, MediaPreviewLightbox } from "./media-hover-box";
import { LibtvNodeHeaderActions } from "./libtv-node-header-preview-button";
import { useLibtvNodeDuplicate, crewNodeShowsParticipatingBadge } from "./libtv-node-header-bar";
import { Pro2CrewTaskStatusBadge } from "./pro2/pro2-crew-task-status-badge";
import { Pro2ImageNodeToolbar } from "./pro2/pro2-image-node-toolbar";
import { Pro2ImageGridSplitToolbar } from "./pro2/pro2-image-grid-split-toolbar";
import { LibtvImageGridSplitStage } from "./libtv-image-grid-split-stage";
import { LibtvNodeToolbarPortal } from "./libtv-node-toolbar-portal";
import { LibtvEditableNodeTitle } from "./libtv-editable-node-title";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "./pro2/pro2-media-node-empty";
import { Pro2NodeSidePlus } from "./pro2/pro2-node-side-plus";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import {
  LibtvMediaGeneratingState,
  isLibtvMediaGenerating,
} from "./libtv-media-generating-state";
import { LibtvNodeErrorBanner } from "./libtv-node-error-banner";
import { useLibtvRuntimeErrorBanner } from "@/lib/canvas/use-libtv-runtime-error-banner";
import {
  libtvRuntimeErrorAlertTitle,
  useLibtvRuntimeErrorAlert,
} from "@/lib/canvas/libtv-runtime-error-alert";
import { isMislabeledVendorSuccessError } from "@/lib/canvas/friendly-task-error";
import { LibtvGridSplitCropSprite } from "@/components/canvas/libtv-grid-split-crop-sprite";
import type { GridSplitCrop } from "@/lib/canvas/libtv-grid-split-crop";
import { batchRunNodes } from "@/lib/canvas/batch-run-nodes";
import type { LibtvGridHdScaleId } from "@/lib/canvas/libtv-grid-split-hd";
import {
  libtvGridSplitFromDimensions,
  spawnExpandImageFromGridSplit,
  spawnFrameGroupFromGridSplit,
  spawnHdImageFromGridSplit,
  toggleGridSplitCell,
  type LibtvImageGridSplitState,
} from "@/lib/canvas/libtv-image-grid-split";
import {
  spawnLibtvImageEditTarget,
  type LibtvImageEditMenuId,
} from "@/lib/canvas/libtv-image-toolbar-edit";
import {
  startLibtvMagicEditFromMenu,
  type LibtvImageMagicMenuId,
} from "@/lib/canvas/libtv-image-toolbar-magic";
import {
  clearLibtvInpaintSession,
  isLibtvInpaintSessionActive,
  patchLibtvInpaintSession,
  type LibtvInpaintSession,
} from "@/lib/canvas/libtv-inpaint-session";
import {
  clearLibtvEraseSession,
  isLibtvEraseSessionActive,
  patchLibtvEraseSession,
  type LibtvEraseSession,
} from "@/lib/canvas/libtv-erase-session";
import {
  clearLibtvCropSession,
  isLibtvCropSessionActive,
  patchLibtvCropSession,
  type LibtvCropSession,
} from "@/lib/canvas/libtv-crop-session";
import {
  clearLibtvExpandSession,
  isLibtvExpandSessionActive,
  patchLibtvExpandSession,
  type LibtvExpandSession,
} from "@/lib/canvas/libtv-expand-session";
import { runLibtvCrop } from "@/lib/canvas/libtv-crop-run";
import { runLibtvExpand } from "@/lib/canvas/libtv-expand-run";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import {
  registerCropCanvas,
  registerExpandCanvas,
  registerInpaintCanvas,
} from "@/lib/canvas/libtv-inpaint-canvas-registry";
import { ImageLocalEditCanvas } from "@/components/canvas/inpaint/image-local-edit-canvas";
import type { ImageLocalEditCanvasHandle } from "@/components/canvas/inpaint/image-local-edit-canvas";
import { ImageCropCanvas } from "@/components/canvas/inpaint/image-crop-canvas";
import type { ImageCropCanvasHandle } from "@/components/canvas/inpaint/image-crop-canvas";
import { ImageExpandCanvas } from "@/components/canvas/inpaint/image-expand-canvas";
import type { ImageExpandCanvasHandle } from "@/components/canvas/inpaint/image-expand-canvas";
import { ImageLocalEditToolbar } from "@/components/canvas/inpaint/image-local-edit-toolbar";
import { LibtvMagicEditFrameDockPortal } from "@/components/canvas/inpaint/libtv-magic-edit-frame-dock-portal";
import {
  ImageCropFrameDock,
  ImageExpandFrameDock,
} from "@/components/canvas/inpaint/image-magic-edit-frame-dock";
import { useUserProviders } from "@/lib/canvas/use-user-providers";

export type LibtvImageNodeEdition = "pro2" | "sbv1";

export type LibtvImageNodeData = CanvasPortraitNodeFields & {
  label?: string;
  ossUrl?: string;
  blobUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  runtime?: CanvasNodeRuntime;
  dockInput?: string;
  engine?: CanvasEnginePick;
  imageMode?: string;
  pro2MediaRole?: Pro2ImageMediaRole | string;
  /** 数据锚点列节点 id（story-pro2-frame / story-pro2-character） */
  pro2ControllerNodeId?: string;
  gridSplit?: LibtvImageGridSplitState;
  gridSplitCrop?: GridSplitCrop;
  /** 全局资产库素材 · UI 角标（平台入库 / 从平台库选用） */
  globalCatalogMarked?: boolean;
  /** 原位重绘会话（魔术 · 重绘） */
  libtvInpaintSession?: LibtvInpaintSession;
  libtvInpaintGenerating?: boolean;
  libtvMagicEditGenerating?: boolean;
  libtvEraseSession?: LibtvEraseSession;
  libtvCropSession?: LibtvCropSession;
  libtvExpandSession?: LibtvExpandSession;
};

export type LibtvImageNodeProps = NodeProps & {
  edition: LibtvImageNodeEdition;
  rfNodeType: "sbv1-image" | "story-pro2-image";
  saveAsAssetKind: "sbv1-image" | "story-pro2-image";
  leftMenuSections: Pro2AddMenuSection[];
  rightMenuSections: Pro2AddMenuSection[];
  onSidePickLeft: (itemId: string, nodeType?: string) => void;
  onSidePickRight: (itemId: string, nodeType?: string) => void;
  onSelectAfterDuplicate: (newId: string) => void;
};

const EDITION_CHROME: Record<
  LibtvImageNodeEdition,
  { icon: string; spinner: string; generating: "violet" | "cyan" }
> = {
  pro2: {
    icon: "text-white/70",
    spinner: CANVAS_SEMANTIC_STATUS_CLASS,
    generating: "violet",
  },
  sbv1: {
    icon: "text-white/70",
    spinner: CANVAS_SEMANTIC_STATUS_CLASS,
    generating: "cyan",
  },
};

/** LibTV 统一图片节点（分镜 1.0 · 影视专业 2.0） */
export function LibtvImageNode({
  id,
  data,
  selected,
  edition,
  rfNodeType,
  saveAsAssetKind,
  leftMenuSections,
  rightMenuSections,
  onSidePickLeft,
  onSidePickRight,
  onSelectAfterDuplicate,
}: LibtvImageNodeProps) {
  const chrome = EDITION_CHROME[edition];
  const base = useBookMallBaseUrl();
  const { alert, confirm } = useDialogs();
  const rfNodes = useNodes();
  const { setNodes: rfSetNodes } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const createGroupContaining = useCanvasStore((s) => s.createGroupContaining);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const inputRef = useRef<HTMLInputElement>(null);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const [preferBlobPreview, setPreferBlobPreview] = useState(false);
  const [preferEphemeralPreview, setPreferEphemeralPreview] = useState(false);
  const projectId = useCanvasStore((s) => s.projectId) ?? undefined;

  const d = data as unknown as LibtvImageNodeData;
  useEffect(() => {
    setPreferBlobPreview(false);
    setPreferEphemeralPreview(false);
  }, [d.ossUrl, d.blobUrl, d.uploading, d.runtime?.ephemeralUrl]);

  const { history: taskHistory } = useNodeTaskHistory(id);
  const inflightTask = useMemo(
    () =>
      pickActiveServerInflightTask(
        taskHistory,
        d.runtime?.taskId,
        d.runtime,
      ),
    [taskHistory, d.runtime],
  );

  const boundTerminalPreviewUrl = useMemo(() => {
    const boundId = d.runtime?.taskId?.trim();
    if (!boundId) return "";
    const terminal = taskHistory.find(
      (t) => t.id === boundId && t.status === "SUCCEEDED",
    );
    if (!terminal) return "";
    return pickTaskImagePreviewUrl(terminal) ?? "";
  }, [taskHistory, d.runtime?.taskId]);

  const previewUrl = useMemo(() => {
    const gridSource = String(
      (d as { gridSplitSourceUrl?: string }).gridSplitSourceUrl ?? "",
    ).trim();
    if (d.gridSplitCrop && gridSource) return gridSource;
    const fromNode = resolveLibtvMediaPreviewUrl({
      ossUrl: d.ossUrl,
      blobUrl: d.blobUrl,
      ephemeralUrl: d.runtime?.ephemeralUrl,
      uploading: d.uploading,
      runtime: d.runtime,
      preferBlob: preferBlobPreview,
      preferEphemeral: preferEphemeralPreview,
    });
    if (fromNode) return fromNode;
    return boundTerminalPreviewUrl;
  }, [
    d.gridSplitCrop,
    (d as { gridSplitSourceUrl?: string }).gridSplitSourceUrl,
    d.ossUrl,
    d.blobUrl,
    d.runtime,
    d.uploading,
    preferBlobPreview,
    preferEphemeralPreview,
    boundTerminalPreviewUrl,
  ]);
  const onPreviewLoadError = useCallback(() => {
    if (
      !preferEphemeralPreview &&
      libtvMediaPreviewCanFallbackToEphemeral({
        ossUrl: d.ossUrl,
        ephemeralUrl: d.runtime?.ephemeralUrl,
      })
    ) {
      setPreferEphemeralPreview(true);
      return;
    }
    if (libtvMediaPreviewCanFallbackToBlob(d)) {
      setPreferBlobPreview(true);
    }
  }, [d, preferEphemeralPreview]);
  const saveAsAsset = useSaveNodeAsAsset();
  const saveToCatalog = useSaveToCatalog();
  const markGlobalCatalog = useCallback(() => {
    updateNodeData(id, { globalCatalogMarked: true });
  }, [id, updateNodeData]);
  const catalogImageUrl = (d.ossUrl?.trim() || previewUrl?.trim() || "").trim();
  const canSaveToCatalog =
    Boolean(catalogImageUrl) &&
    (catalogImageUrl.startsWith("http://") || catalogImageUrl.startsWith("https://"));
  const self = nodes.find((n) => n.id === id);
  const insideGroup = Boolean(self?.parentId);
  const mediaRole = d.pro2MediaRole ?? "generic";
  const isCharacterThreeView = mediaRole === "character-three-view";
  const hasImage = Boolean(previewUrl);
  const portraitActive = isPortraitNodeActive(
    (self?.data ?? d) as CanvasPortraitNodeFields,
  );
  const { importPortrait, importing: portraitImporting } =
    useImportPortraitToLibrary({
      nodeId: id,
      edition,
      projectId,
      imageUrl: d.ossUrl,
      onNeedLiveness: () => setLivenessOpen(true),
    });
  const isDirectorDeskShot = mediaRole === "director-desk-shot";
  const isDirectorDeskShotLocalPreview =
    isDirectorDeskShot &&
    hasImage &&
    Boolean(d.uploading) &&
    !d.runtime?.taskId;
  const isInpaintGenerating = Boolean(
    d.libtvInpaintGenerating || d.libtvMagicEditGenerating,
  );
  const isGenerating = isDirectorDeskShotLocalPreview
    ? false
    : Boolean(inflightTask) || isLibtvMediaGenerating(d) || isInpaintGenerating;

  useLayoutEffect(() => {
    if (inflightTask) return;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const localRt = (node?.data as LibtvImageNodeData | undefined)?.runtime;
    const boundId = localRt?.taskId?.trim();
    if (!boundId) return;

    const localSt = localRt?.status;
    if (localSt !== "pending" && localSt !== "running") return;

    const terminal = taskHistory.find(
      (t) =>
        t.id === boundId &&
        (t.status === "SUCCEEDED" ||
          t.status === "FAILED" ||
          t.status === "CANCELLED"),
    );
    if (!terminal) return;
    if (shouldSkipStoryRowTaskApply(localRt, terminal, id)) return;

    const nodePatch = sbv1ImagePatchFromTask(
      (node?.data ?? {}) as unknown as Sbv1ImageNodeData,
      terminal,
    );
    if (!nodePatch) return;
    const rtPatch = nodePatch.runtime as Partial<CanvasNodeRuntime> | undefined;
    if (!rtPatch) return;
    if (!shouldApplyCanvasTaskRuntimePatch(localRt, terminal, rtPatch, id)) {
      return;
    }
    if (
      isSameSbv1MediaDataPatch(node?.data as Record<string, unknown>, nodePatch)
    ) {
      return;
    }
    updateNodeData(id, nodePatch);
  }, [taskHistory, id, updateNodeData, inflightTask]);
  const hasRuntimeError = d.runtime?.status === "error";
  const hasUploadError = Boolean(d.uploadError?.trim()) && !isGenerating;
  const hasError = hasRuntimeError || hasUploadError;
  const errorMessage = hasRuntimeError
    ? d.runtime?.failMessage?.trim() || "生成失败"
    : d.uploadError?.trim() || "生成失败";
  const imageModelKey = d.engine?.modelKey;
  const errorBanner = useLibtvRuntimeErrorBanner({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
    modelKey: imageModelKey,
    hasMedia: Boolean(hasImage && !hasRuntimeError),
  });
  useLibtvRuntimeErrorAlert({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
    modelKey: imageModelKey,
    enabled: !isMislabeledVendorSuccessError(
      d.runtime?.failCode,
      d.runtime?.failMessage,
    ) &&
      !(
        d.runtime?.failCode === "RUN_STALE" &&
        Boolean(d.pro2ControllerNodeId?.trim())
      ),
    onAlert: ({ message, failCode }) => {
      if (
        failCode === "INSUFFICIENT_CREDITS" ||
        message.includes("积分不足") ||
        message.includes("积分不够")
      ) {
        void confirmOpenTopupCheckout(confirm);
        return;
      }
      void alert({
        title: libtvRuntimeErrorAlertTitle(failCode, message, "image"),
        message,
        variant: "error",
        dismissOnly: true,
      });
    },
  });
  const inpaintSession = isLibtvInpaintSessionActive(d as Record<string, unknown>)
    ? (d as { libtvInpaintSession: LibtvInpaintSession }).libtvInpaintSession
    : undefined;
  const eraseSession = isLibtvEraseSessionActive(d as Record<string, unknown>)
    ? (d as { libtvEraseSession: LibtvEraseSession }).libtvEraseSession
    : undefined;
  const cropSession = isLibtvCropSessionActive(d as Record<string, unknown>)
    ? (d as { libtvCropSession: LibtvCropSession }).libtvCropSession
    : undefined;
  const expandSession = isLibtvExpandSessionActive(d as Record<string, unknown>)
    ? (d as { libtvExpandSession: LibtvExpandSession }).libtvExpandSession
    : undefined;
  const inpaintActive = Boolean(inpaintSession?.active && hasImage);
  const eraseActive = Boolean(eraseSession?.active && hasImage);
  const cropActive = Boolean(cropSession?.active && hasImage);
  const expandActive = Boolean(expandSession?.active && hasImage);
  const selectionEditActive = inpaintActive || eraseActive;
  const magicEditActive =
    selectionEditActive || cropActive || expandActive;
  const showSidePlus = Boolean(
    (hovered || selected || connectingFromNodeId) &&
      !isGenerating &&
      !magicEditActive,
  );
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const showTryMenu =
    !isCharacterThreeView && !hasImage && !isGenerating && !hasError;
  const showFloatingToolbar = Boolean(soleSelected && !isGenerating);
  const gridSplit = d.gridSplit;
  const gridSplitActive = Boolean(gridSplit && edition === "pro2");
  const showImageTools = Boolean(
    showFloatingToolbar &&
      !isCharacterThreeView &&
      !gridSplitActive &&
      hasImage,
  );
  const inpaintModelKey =
    String((d as { engine?: { modelKey?: string } }).engine?.modelKey ?? "").trim() ||
    inpaintSession?.modelKey ||
    "qwen-image-edit";
  const inpaintSelectionMode =
    inpaintModelKey.trim().toLowerCase() === "wan2.7-image-pro" ? "bbox" : "mask";
  const showNormalToolbar = showImageTools && !magicEditActive;
  const showInpaintToolbar = Boolean(inpaintActive && !isGenerating);
  const showEraseToolbar = Boolean(eraseActive && !isGenerating);
  const showCropFrameDock = Boolean(cropActive && !isGenerating);
  const showExpandFrameDock = Boolean(expandActive && !isGenerating);
  const showGridSplitToolbar = Boolean(
    soleSelected && gridSplitActive && !isGenerating,
  );
  const { providers } = useUserProviders();
  const inpaintCanvasRef = useRef<ImageLocalEditCanvasHandle | null>(null);
  const inpaintCanvasUnregisterRef = useRef<(() => void) | null>(null);
  const [inpaintCanUndo, setInpaintCanUndo] = useState(false);
  const [inpaintCanRedo, setInpaintCanRedo] = useState(false);

  const bindInpaintCanvasRef = useCallback(
    (handle: ImageLocalEditCanvasHandle | null) => {
      inpaintCanvasUnregisterRef.current?.();
      inpaintCanvasUnregisterRef.current = null;
      inpaintCanvasRef.current = handle;
      if (handle && selectionEditActive) {
        inpaintCanvasUnregisterRef.current = registerInpaintCanvas(id, handle);
      }
    },
    [id, selectionEditActive],
  );

  const cropCanvasRef = useRef<ImageCropCanvasHandle | null>(null);
  const cropCanvasUnregisterRef = useRef<(() => void) | null>(null);
  const expandCanvasRef = useRef<ImageExpandCanvasHandle | null>(null);
  const expandCanvasUnregisterRef = useRef<(() => void) | null>(null);
  const [cropConfirming, setCropConfirming] = useState(false);
  const magicEditGenerating = Boolean(
    (d as { libtvMagicEditGenerating?: boolean }).libtvMagicEditGenerating,
  );
  const expandCredits = useModelCreditsPreview(
    "image-out-painting",
    0,
    undefined,
    expandSession?.outputCount ?? 1,
    expandSession?.resolution ?? "2K",
  );

  const bindCropCanvasRef = useCallback(
    (handle: ImageCropCanvasHandle | null) => {
      cropCanvasUnregisterRef.current?.();
      cropCanvasUnregisterRef.current = null;
      cropCanvasRef.current = handle;
      if (handle && cropActive) {
        cropCanvasUnregisterRef.current = registerCropCanvas(id, handle);
      }
    },
    [id, cropActive],
  );

  const bindExpandCanvasRef = useCallback(
    (handle: ImageExpandCanvasHandle | null) => {
      expandCanvasUnregisterRef.current?.();
      expandCanvasUnregisterRef.current = null;
      expandCanvasRef.current = handle;
      if (handle && expandActive) {
        expandCanvasUnregisterRef.current = registerExpandCanvas(id, handle);
      }
    },
    [id, expandActive],
  );

  useEffect(() => {
    if (selectionEditActive) return;
    inpaintCanvasUnregisterRef.current?.();
    inpaintCanvasUnregisterRef.current = null;
  }, [selectionEditActive]);

  useEffect(() => {
    if (cropActive) return;
    cropCanvasUnregisterRef.current?.();
    cropCanvasUnregisterRef.current = null;
  }, [cropActive]);

  useEffect(() => {
    if (expandActive) return;
    expandCanvasUnregisterRef.current?.();
    expandCanvasUnregisterRef.current = null;
  }, [expandActive]);

  useEffect(
    () => () => {
      inpaintCanvasUnregisterRef.current?.();
      inpaintCanvasUnregisterRef.current = null;
    },
    [id],
  );

  useEffect(() => {
    if (!selectionEditActive) return;
    const t = window.setInterval(() => {
      const h = inpaintCanvasRef.current;
      if (!h) return;
      setInpaintCanUndo(h.canUndo());
      setInpaintCanRedo(h.canRedo());
    }, 200);
    return () => window.clearInterval(t);
  }, [selectionEditActive]);

  const closeInpaintSession = useCallback(() => {
    clearLibtvInpaintSession(id, setNodes, rfSetNodes);
  }, [id, rfSetNodes, setNodes]);

  const closeEraseSession = useCallback(() => {
    clearLibtvEraseSession(id, setNodes, rfSetNodes);
  }, [id, rfSetNodes, setNodes]);

  const closeCropSession = useCallback(() => {
    clearLibtvCropSession(id, setNodes, rfSetNodes);
  }, [id, rfSetNodes, setNodes]);

  const closeExpandSession = useCallback(() => {
    clearLibtvExpandSession(id, setNodes, rfSetNodes);
  }, [id, rfSetNodes, setNodes]);

  const onConfirmExpand = useCallback(() => {
    const sourceUrl = d.ossUrl ?? d.blobUrl ?? "";
    if (!sourceUrl) return;
    if (!projectId) {
      void alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    void (async () => {
      try {
        await runLibtvExpand({
          sourceNodeId: id,
          projectId,
          sourceImageUrl: sourceUrl,
          nodes,
          addNode,
          setNodes,
          setEdges,
          onGeneratingChange: (generating) =>
            updateNodeData(id, { libtvMagicEditGenerating: generating }),
        });
      } catch (e) {
        await alert({
          title: "扩图失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      }
    })();
  }, [
    d.ossUrl,
    d.blobUrl,
    id,
    projectId,
    nodes,
    addNode,
    setNodes,
    setEdges,
    updateNodeData,
    alert,
  ]);

  const onConfirmCrop = useCallback(() => {
    const sourceUrl = d.ossUrl ?? d.blobUrl ?? "";
    if (!sourceUrl) return;
    void (async () => {
      setCropConfirming(true);
      try {
        await runLibtvCrop({
          sourceNodeId: id,
          sourceImageUrl: sourceUrl,
          nodes,
          addNode,
          setNodes,
          setEdges,
          onGeneratingChange: (generating) =>
            updateNodeData(id, { libtvMagicEditGenerating: generating }),
        });
      } catch (e) {
        await alert({
          title: "裁剪失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setCropConfirming(false);
      }
    })();
  }, [d.ossUrl, d.blobUrl, id, nodes, addNode, setNodes, setEdges, updateNodeData, alert]);

  const pro2ImageToolbarExtras = Boolean(
    edition === "pro2" && hasImage && !isCharacterThreeView,
  );

  /** Stage 内图片/视频 · cover 铺满，避免比例未齐时出现深色留边 */
  const stageImageFit: "cover" | "contain" = "cover";

  const gridSplitCropCss = d.gridSplitCrop;

  const skipNaturalSizeAutoFit = useCanvasStore((s) => {
    const node = s.nodes.find((n) => n.id === id);
    if (!node) {
      return Boolean((d as { gridSplitFrameCrop?: boolean }).gridSplitFrameCrop);
    }
    return shouldSkipLibtvImageNodeNaturalSizeAutoFit(node, s.nodes);
  });

  useLibtvMediaAspectPresetSync(
    id,
    (d as { aspectRatio?: string }).aspectRatio,
    !isCharacterThreeView &&
      !gridSplitCropCss &&
      !skipNaturalSizeAutoFit &&
      !(
        (d as { pro2HdFromGridSplit?: boolean }).pro2HdFromGridSplit &&
        !(d as { mediaAspectPreset?: string }).mediaAspectPreset?.trim()
      ),
  );

  useLibtvMediaNodeAutoFit({
    nodeId: id,
    mediaUrl: previewUrl,
    kind: "image",
    profile: "sbv1-media",
    // 本地上传/粘贴时按 blob 立即自适配（blob 探测必成功），避免只等 ossUrl
    // ——OSS 探测偶发慢/失败会让外框停在默认比例，露出深色舞台「边框/投影」。
    // 仅 AI 生成中（非上传）才暂停自适配，避免贴合占位旧图。
    disabled:
      !hasImage ||
      isCharacterThreeView ||
      skipNaturalSizeAutoFit ||
      Boolean(d.uploading) ||
      (isGenerating && !d.uploading),
  });

  /** 侧 + 拉出邻居后 graph 变更 · 若外框仍停在默认横条则按 natural 重算 */
  useEffect(() => {
    if (!hasImage || isCharacterThreeView || d.uploading) return;
    const state = useCanvasStore.getState();
    const node = state.nodes.find((n) => n.id === id);
    if (!node || shouldSkipLibtvImageNodeNaturalSizeAutoFit(node, state.nodes)) {
      return;
    }
    if (!isLibtvMediaNodeBoxStale(node, "sbv1-media")) return;
    const url = previewUrl?.trim();
    if (!url) return;
    fitLibtvUploadedImageNaturalSize(id, url);
  }, [edges, id, hasImage, isCharacterThreeView, d.uploading, previewUrl]);

  const applyLibtvMediaFit = useCanvasStore((s) => s.applyLibtvMediaFit);
  const onStageNaturalSize = useCallback(
    ({ w, h }: { w: number; h: number }) => {
      if (isCharacterThreeView || !previewUrl?.trim()) return;
      const state = useCanvasStore.getState();
      const node = state.nodes.find((n) => n.id === id);
      if (!node) return;
      if (shouldSkipLibtvImageNodeNaturalSizeAutoFit(node, state.nodes)) {
        return;
      }
      if (
        (node.data as { mediaAspectPreset?: string }).mediaAspectPreset?.trim()
      ) {
        return;
      }
      const nodeData = node.data as {
        uploading?: boolean;
        mediaFit?: boolean;
        mediaFitKey?: string;
        mediaNaturalW?: number;
        mediaNaturalH?: number;
      };
      const nextData = {
        ...((node.data as object) ?? {}),
        mediaNaturalW: w,
        mediaNaturalH: h,
      };
      const probe = { ...node, data: nextData };
      const uploading = Boolean(nodeData.uploading);
      const needsFit =
        uploading || isLibtvMediaNodeBoxStale(probe, "sbv1-media");
      if (!needsFit) {
        if (nodeData.mediaNaturalW !== w || nodeData.mediaNaturalH !== h) {
          updateNodeData(id, { mediaNaturalW: w, mediaNaturalH: h });
        }
        return;
      }
      const size = computeLibtvMediaNodeSize(w, h, "sbv1-media");
      const fitPrefix = uploading ? "upload" : "image";
      applyLibtvMediaFit(id, size, {
        mediaFit: true,
        mediaFitKey: `${fitPrefix}|${previewUrl.trim()}|sbv1-media`,
        mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
        mediaNaturalW: w,
        mediaNaturalH: h,
      });
    },
    [applyLibtvMediaFit, id, isCharacterThreeView, previewUrl, updateNodeData],
  );

  const defaultNodeLabel = useMemo(() => {
    if (isCharacterThreeView) return "角色";
    const imgs = nodes.filter((n) => n.type === rfNodeType);
    const idx = imgs.findIndex((n) => n.id === id);
    return `图片 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id, isCharacterThreeView, rfNodeType]);

  const nodeLabel = useMemo(() => {
    if (d.label?.trim()) return d.label.trim();
    return defaultNodeLabel;
  }, [d.label, defaultNodeLabel]);

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const onFile = useCallback(
    (file: File) => {
      if (
        !file ||
        (!file.type.startsWith("image/") &&
          !/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name) &&
          !(file.size > 0 && !file.type))
      ) {
        return;
      }
      const blobUrl = URL.createObjectURL(file);
      updateNodeData(id, {
        blobUrl,
        ossUrl: undefined,
        uploading: true,
        uploadError: undefined,
        label: file.name.replace(/\.[^.]+$/, "") || "图片",
        mediaAspectPreset: "",
        imageMode: "upload" as const,
      });
      scheduleCanvasImageUpload({
        nodeId: id,
        file,
        base,
        updateNodeData,
        previewBlobUrl: blobUrl,
        onUploadError: (message) => {
          void alert({
            title: "上传失败",
            message,
            variant: "error",
          });
        },
      });
      fitLibtvUploadedImageNaturalSize(id, blobUrl);
    },
    [id, base, updateNodeData, alert, edition],
  );

  const pasteHostActive = hovered || Boolean(selected && showTryMenu);
  usePointerImagePasteHost(pasteHostActive, id, (file) => void onFile(file));

  const onDuplicateNode = useCallback(() => {
    const newId = duplicateNode(id, { preserveContent: true });
    if (newId) {
      selectLibtvNodeAfterDuplicate(rfSetNodes, newId, rfNodeType);
      onSelectAfterDuplicate(newId);
    }
  }, [duplicateNode, id, rfSetNodes, rfNodeType, onSelectAfterDuplicate]);

  const clearGridSplit = useCallback(() => {
    updateNodeData(id, { gridSplit: undefined });
  }, [id, updateNodeData]);

  const onEditPick = useCallback(
    (menuId: LibtvImageEditMenuId) => {
      if (edition !== "pro2") return;
      spawnLibtvImageEditTarget(id, menuId, {
        nodes,
        addNode,
        setNodes,
        setEdges,
      });
    },
    [edition, id, nodes, addNode, setNodes, setEdges],
  );

  const onMagicPick = useCallback(
    (menuId: LibtvImageMagicMenuId) => {
      if (edition !== "pro2") return;
      startLibtvMagicEditFromMenu(
        id,
        menuId,
        { nodes, addNode, setNodes, setEdges },
        providers,
      );
    },
    [edition, id, nodes, addNode, setNodes, setEdges, providers],
  );

  const onGridSplitPick = useCallback(
    (cols: number, rows: number) => {
      if (edition !== "pro2" || !hasImage) return;
      const split = libtvGridSplitFromDimensions(cols, rows);
      if (!split) return;
      updateNodeData(id, { gridSplit: split });
    },
    [edition, hasImage, id, updateNodeData],
  );

  const onToggleGridCell = useCallback(
    (cellIndex: number) => {
      if (!gridSplit) return;
      updateNodeData(id, {
        gridSplit: toggleGridSplitCell(gridSplit, cellIndex),
      });
    },
    [gridSplit, id, updateNodeData],
  );

  const onCreateFrameGroupFromSplit = useCallback(() => {
    if (!gridSplit?.selected.length) return;
    void (async () => {
      const groupId = await spawnFrameGroupFromGridSplit(id, gridSplit, {
        nodes,
        addNode,
        addNodeInGroup,
        createGroupContaining,
        updateNodeData,
        setNodes,
        setEdges,
      });
      if (!groupId) {
        await alert({
          title: "创建失败",
          message: "无法创建分镜组，请重试。",
          variant: "error",
        });
        return;
      }
      clearGridSplit();
    })();
  }, [
    gridSplit,
    id,
    nodes,
    addNode,
    addNodeInGroup,
    createGroupContaining,
    updateNodeData,
    setNodes,
    setEdges,
    clearGridSplit,
    alert,
  ]);

  const onExpandFromGridSplit = useCallback(() => {
    if (!gridSplit?.selected.length) return;
    void (async () => {
      const newIds = await spawnExpandImageFromGridSplit(id, gridSplit, {
        nodes,
        addNode,
        setNodes,
        setEdges,
      });
      if (!newIds.length) {
        await alert({
          title: "扩图失败",
          message: "无法创建图片节点，请重试。",
          variant: "error",
        });
        return;
      }
      clearGridSplit();
    })();
  }, [gridSplit, id, nodes, addNode, setNodes, setEdges, clearGridSplit, alert]);

  const onGenerateHdFromGridSplit = useCallback(
    (scaleId: LibtvGridHdScaleId) => {
      if (!gridSplit?.selected.length) return;
      if (!base) {
        void alert({
          title: "无法生成",
          message: "画布未就绪，请刷新页面后重试。",
          variant: "error",
        });
        return;
      }
      void (async () => {
        const { runnableIds } = await spawnHdImageFromGridSplit(
          id,
          gridSplit,
          scaleId,
          {
            nodes,
            getNodes: () => useCanvasStore.getState().nodes,
            addNode,
            setNodes,
            setEdges,
            base,
            projectId,
            updateNodeData,
          },
        );
        if (!runnableIds.length) {
          void alert({
            title: "生成失败",
            message: "宫格裁切失败，无法生成高清图，请确认原图已加载后重试。",
            variant: "error",
          });
          return;
        }
        clearGridSplit();
        batchRunNodes(runnableIds);
      })();
    },
    [gridSplit, id, nodes, addNode, setNodes, setEdges, updateNodeData, clearGridSplit, alert, base, projectId],
  );

  useEffect(() => {
    if (!gridSplitActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      clearGridSplit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gridSplitActive, clearGridSplit]);

  useEffect(() => {
    if (!gridSplitActive) return;
    const onPaneClick = () => clearGridSplit();
    window.addEventListener("canvas:pro2-pane-click", onPaneClick);
    return () =>
      window.removeEventListener("canvas:pro2-pane-click", onPaneClick);
  }, [gridSplitActive, clearGridSplit]);

  useEffect(() => {
    if (gridSplit && !soleSelected) {
      clearGridSplit();
    }
  }, [gridSplit, soleSelected, clearGridSplit]);

  const renderStage = () => {
    if (isCharacterThreeView) {
      if (isGenerating) {
        return (
          <LibtvMediaGeneratingState variant={chrome.generating} cancelNodeId={id} />
        );
      }
      if (hasImage) {
        return (
          <MediaHoverBox
            src={previewUrl}
            variant="generated"
            alt={nodeLabel}
            fit="cover"
            previewChrome="ecom"
            onImageError={onPreviewLoadError}
            className="absolute inset-0"
          />
        );
      }
      if (hasError) {
        return (
          <Pro2MediaNodeErrorState
            icon={AlertTriangle}
            title="生成失败"
            message={errorMessage}
          />
        );
      }
      return (
        <Pro2MediaNodeEmptyState
          icon={ImageIcon}
          label="等待生成三视图"
          passNodeDrag
        />
      );
    }

    if (isGenerating) {
      const cropPreview =
        gridSplitCropCss && previewUrl ? (
          <LibtvGridSplitCropSprite
            url={previewUrl}
            crop={gridSplitCropCss}
            className="absolute inset-0 opacity-40"
          />
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-0 size-full object-contain opacity-40"
            draggable={false}
            onError={onPreviewLoadError}
          />
        ) : null;
      return (
        <LibtvMediaGeneratingState variant={chrome.generating} cancelNodeId={id}>
          {cropPreview}
        </LibtvMediaGeneratingState>
      );
    }
    if (hasRuntimeError) {
      return (
        <div className="absolute inset-0 flex flex-col">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 size-full object-contain opacity-25"
              draggable={false}
              onError={onPreviewLoadError}
            />
          ) : null}
          <Pro2MediaNodeErrorState
            icon={AlertTriangle}
            title={hasUploadError && !hasRuntimeError ? "上传失败" : "生成失败"}
            message={errorMessage}
          />
        </div>
      );
    }
    if (hasImage) {
      if (gridSplit && previewUrl) {
        return (
          <LibtvImageGridSplitStage
            src={previewUrl}
            alt={nodeLabel}
            split={gridSplit}
            onToggleCell={onToggleGridCell}
            onImageError={onPreviewLoadError}
          />
        );
      }
      if (gridSplitCropCss && previewUrl) {
        return (
          <LibtvGridSplitCropSprite
            url={previewUrl}
            crop={gridSplitCropCss}
            className="absolute inset-0"
          />
        );
      }
      if (selectionEditActive && previewUrl) {
        const session = inpaintActive ? inpaintSession : eraseSession;
        return (
          <ImageLocalEditCanvas
            ref={bindInpaintCanvasRef}
            imageUrl={previewUrl}
            tool={session?.tool ?? (eraseActive ? "brush" : "rect")}
            brushSize={session?.brushSize ?? 24}
            selectionMode={eraseActive ? "mask" : inpaintSelectionMode}
          />
        );
      }
      if (cropActive && previewUrl && cropSession) {
        return (
          <ImageCropCanvas
            ref={bindCropCanvasRef}
            frameAnchorNodeId={id}
            imageUrl={previewUrl}
            aspectRatio={cropSession.aspectRatio}
          />
        );
      }
      if (expandActive && previewUrl && expandSession) {
        return (
          <ImageExpandCanvas
            ref={bindExpandCanvasRef}
            frameAnchorNodeId={id}
            imageUrl={previewUrl}
            aspectRatio={expandSession.aspectRatio ?? "original"}
          />
        );
      }
      return (
        <MediaHoverBox
          src={previewUrl}
          variant="generated"
          alt={nodeLabel}
          fit={stageImageFit}
          previewChrome="ecom"
          onImageError={onPreviewLoadError}
          onNaturalSize={
            skipNaturalSizeAutoFit ? undefined : onStageNaturalSize
          }
          className="absolute inset-0"
        />
      );
    }
    if (hasError) {
      return (
        <div
          role="button"
          tabIndex={0}
          className="absolute inset-0 flex flex-col"
          onClick={onPick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick();
            }
          }}
        >
          <Pro2MediaNodeErrorState
            icon={AlertTriangle}
            title={hasUploadError && !hasRuntimeError ? "上传失败" : "生成失败"}
            message={errorMessage}
          />
        </div>
      );
    }
    if (showTryMenu) {
      return (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-3 py-4"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (selected && !isGenerating) onPick();
          }}
        >
          <Pro2MediaNodeEmptyState
            icon={ImageIcon}
            label="添加或生成图片"
            className="min-h-0 pb-0"
            passNodeDrag
          />
          {!selected ? (
            <p className="mt-3 text-[10px] text-white/35">选中节点以编辑提示词</p>
          ) : (
            <p className="mt-3 text-[10px] text-white/35">
              双击图标上传，或在下方 Dock 输入提示词
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div
        className={cn(
          LIBTV_NODE_OUTER_CLASS,
          magicEditActive && "!overflow-visible",
          edition === "pro2" && LIBTV_CARD_DRAG_CLASS,
          edition === "pro2" && "flex flex-col",
          "image-paste-host",
        )}
        data-image-paste-host={id}
        data-pro2-dock-anchor={id}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {!isCharacterThreeView ? (
          <Handle
            id="in_image"
            type="target"
            position={Position.Left}
            className={cn(
              LIBTV_NODE_HANDLE_CLASS,
              "libtv-node-inbound-handle",
              "pointer-events-none !opacity-0 !border-transparent !bg-transparent",
            )}
            title="上游参考图"
          />
        ) : null}
        {/* 右侧出边由 Pro2NodeSidePlus handleId=image 提供，勿重复声明 Handle */}
        <Pro2NodeSidePlus
          side="left"
          handleId="plus_left"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={leftMenuSections}
          onPick={onSidePickLeft}
        />
        <Pro2NodeSidePlus
          side="right"
          handleId="image"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={rightMenuSections}
          onPick={onSidePickRight}
        />

        {showNormalToolbar ? (
          <LibtvNodeToolbarPortal nodeId={id} visible={showNormalToolbar}>
            <Pro2ImageNodeToolbar
              passNodeDrag
              previewUrl={previewUrl}
              pro2ImageTools={pro2ImageToolbarExtras}
              onEditPick={pro2ImageToolbarExtras ? onEditPick : undefined}
              onMagicPick={pro2ImageToolbarExtras ? onMagicPick : undefined}
              onGridSplitPick={
                pro2ImageToolbarExtras ? onGridSplitPick : undefined
              }
              onExpandPreview={() => setPreviewOpen(true)}
              onSaveAsAsset={() =>
                saveAsAsset(id, saveAsAssetKind, d as unknown as Record<string, unknown>)
              }
              onSaveToCatalog={
                canSaveToCatalog
                  ? () =>
                      saveToCatalog({
                        url: catalogImageUrl,
                        prompt: d.dockInput,
                        sourceModule: `canvas-${edition}-image`,
                        sourceAssetId: id,
                        defaultCatalog: "garment",
                        onCatalogSaved: markGlobalCatalog,
                      })
                  : undefined
              }
              onImportPortrait={
                d.ossUrl ? () => void importPortrait() : undefined
              }
              portraitImporting={portraitImporting}
              portraitActive={portraitActive}
              onDuplicateNode={onDuplicateNode}
            />
          </LibtvNodeToolbarPortal>
        ) : null}

        {showInpaintToolbar && inpaintSession ? (
          <LibtvNodeToolbarPortal
            nodeId={id}
            visible={showInpaintToolbar}
            pinVisible
            toolbarHeightEstimate={52}
          >
            <ImageLocalEditToolbar
              variant="inpaint"
              tool={inpaintSession.tool}
              brushSize={inpaintSession.brushSize}
              modelKey={inpaintModelKey}
              canUndo={inpaintCanUndo}
              canRedo={inpaintCanRedo}
              onToolChange={(tool) =>
                patchLibtvInpaintSession(id, { tool }, setNodes)
              }
              onBrushSizeChange={(brushSize) =>
                patchLibtvInpaintSession(id, { brushSize }, setNodes)
              }
              onModelChange={() => {}}
              onUndo={() => inpaintCanvasRef.current?.undo()}
              onRedo={() => inpaintCanvasRef.current?.redo()}
              onClose={closeInpaintSession}
            />
          </LibtvNodeToolbarPortal>
        ) : null}

        {showEraseToolbar && eraseSession ? (
          <LibtvNodeToolbarPortal
            nodeId={id}
            visible={showEraseToolbar}
            pinVisible
            toolbarHeightEstimate={52}
          >
            <ImageLocalEditToolbar
              variant="erase"
              tool={eraseSession.tool}
              brushSize={eraseSession.brushSize}
              modelKey=""
              canUndo={inpaintCanUndo}
              canRedo={inpaintCanRedo}
              onToolChange={(tool) =>
                patchLibtvEraseSession(id, { tool }, setNodes)
              }
              onBrushSizeChange={(brushSize) =>
                patchLibtvEraseSession(id, { brushSize }, setNodes)
              }
              onModelChange={() => {}}
              onUndo={() => inpaintCanvasRef.current?.undo()}
              onRedo={() => inpaintCanvasRef.current?.redo()}
              onClose={closeEraseSession}
            />
          </LibtvNodeToolbarPortal>
        ) : null}

        {showCropFrameDock && cropSession ? (
          <LibtvMagicEditFrameDockPortal nodeId={id} visible={showCropFrameDock}>
            <ImageCropFrameDock
              aspectRatio={cropSession.aspectRatio}
              confirming={cropConfirming}
              onAspectRatioChange={(aspectRatio) =>
                patchLibtvCropSession(id, { aspectRatio }, setNodes)
              }
              onConfirm={onConfirmCrop}
              onClose={closeCropSession}
            />
          </LibtvMagicEditFrameDockPortal>
        ) : null}

        {showExpandFrameDock && expandSession ? (
          <LibtvMagicEditFrameDockPortal nodeId={id} visible={showExpandFrameDock}>
            <ImageExpandFrameDock
              aspectRatio={expandSession.aspectRatio ?? "original"}
              resolution={expandSession.resolution ?? "2K"}
              outputCount={expandSession.outputCount ?? 1}
              running={magicEditGenerating}
              canSubmit={!magicEditGenerating && hasImage}
              credits={expandCredits?.credits}
              creditsTitle={
                expandCredits?.credits != null
                  ? `image-out-painting · 挂牌 ${expandCredits.creditsPerUnit} 积分/张`
                  : undefined
              }
              onAspectRatioChange={(aspectRatio) =>
                patchLibtvExpandSession(id, { aspectRatio }, setNodes)
              }
              onResolutionChange={(resolution) =>
                patchLibtvExpandSession(id, { resolution }, setNodes)
              }
              onOutputCountChange={(outputCount) =>
                patchLibtvExpandSession(id, { outputCount }, setNodes)
              }
              onClose={closeExpandSession}
              onSubmit={onConfirmExpand}
            />
          </LibtvMagicEditFrameDockPortal>
        ) : null}

        {showGridSplitToolbar && gridSplit ? (
          <LibtvNodeToolbarPortal nodeId={id} visible={showGridSplitToolbar}>
            <Pro2ImageGridSplitToolbar
              passNodeDrag
              selectedCount={gridSplit.selected.length}
              onCancel={clearGridSplit}
              onExpandImage={onExpandFromGridSplit}
              onCreateFrameGroup={onCreateFrameGroupFromSplit}
              onGenerateHd={onGenerateHdFromGridSplit}
            />
          </LibtvNodeToolbarPortal>
        ) : null}

        {edition === "pro2" ? (
          <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
            <GripVertical className="size-3.5 shrink-0 text-white/30" />
            <ImageIcon className="size-3.5 shrink-0 text-violet-300" />
            <LibtvEditableNodeTitle
              nodeId={id}
              defaultLabel={defaultNodeLabel}
              textClassName="text-[11px] text-white"
            />
            {crewNodeShowsParticipatingBadge(id, nodes, graphMeta) ? (
              <Pro2CrewTaskStatusBadge nodeId={id} />
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            LIBTV_MEDIA_CARD_SHELL_CLASS,
            magicEditActive && "!overflow-visible",
            !magicEditActive && LIBTV_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
          )}
          style={libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition,
          })}
        >
          {edition === "sbv1" ? (
            <div className="relative flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-white/10 px-3 py-2 active:cursor-grabbing">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "nodrag flex shrink-0 items-center rounded-md transition",
                    !hasImage &&
                      !isGenerating &&
                      !isCharacterThreeView &&
                      "cursor-pointer hover:bg-white/[0.06]",
                  )}
                  title={
                    !hasImage && !isGenerating && !isCharacterThreeView
                      ? "双击上传图片"
                      : undefined
                  }
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!hasImage && !isGenerating && !isCharacterThreeView) {
                      onPick();
                    }
                  }}
                >
                  <ImageIcon className={cn("size-3.5 shrink-0", chrome.icon)} />
                </button>
                <LibtvEditableNodeTitle
                  nodeId={id}
                  defaultLabel={defaultNodeLabel}
                  textClassName="text-xs font-medium text-white"
                />
              </div>
              {crewNodeShowsParticipatingBadge(id, nodes, graphMeta) ? (
                <Pro2CrewTaskStatusBadge nodeId={id} />
              ) : null}
              <div className="relative z-[1] flex shrink-0 items-center gap-2">
                {!isGenerating && d.ossUrl?.trim() ? (
                  <CanvasSaveToPoseLibraryButton
                    imageUrl={d.ossUrl.trim()}
                    prompt={d.dockInput}
                    sourceModule={`canvas-${edition}-image`}
                    sourceAssetId={id}
                    onCatalogSaved={markGlobalCatalog}
                  />
                ) : null}
                {!isGenerating ? (
                  <LibtvNodeHeaderActions
                    portraitActive={portraitActive}
                    portraitImporting={portraitImporting}
                    showPreview={false}
                    onPreview={() => setPreviewOpen(true)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              LIBTV_MEDIA_STAGE_CLASS,
              magicEditActive && "!overflow-visible",
              "relative flex min-h-0 flex-col",
              magicEditActive && "nodrag nopan nowheel cursor-crosshair",
            )}
          >
            {renderStage()}
            {hasImage && d.globalCatalogMarked ? <GlobalAssetCatalogBadge /> : null}
            <LibtvNodeErrorBanner
              message={errorBanner.message}
              visible={errorBanner.visible}
              onDismiss={errorBanner.dismiss}
            />
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />

      {previewOpen && previewUrl ? (
        <MediaPreviewLightbox
          src={previewUrl}
          kind="image"
          alt={nodeLabel}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      <Sbv1PortraitLivenessModal
        open={livenessOpen}
        onClose={() => setLivenessOpen(false)}
        onSuccess={() => setLivenessOpen(false)}
      />
    </>
  );
}
