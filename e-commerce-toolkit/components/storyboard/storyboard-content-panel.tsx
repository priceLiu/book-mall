"use client";

import { Loader2, Images, Settings2, Download, Link2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SUBTITLE_STYLE,
  SubtitleBurnInFields,
  type SubtitleBurnInStyle,
} from "@private/media-render-subtitle-style";

import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import {
  ensureEcomSessionFresh,
  redirectEcomSessionRefresh,
} from "@/lib/ecom-silent-sso";
import {
  EcomImagePreviewHost,
  useEcomImagePreview,
  buildStoryboardPanelPreviewItems,
} from "@/components/media";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryboardDeliverableReviewDialog } from "@/components/storyboard/storyboard-deliverable-review-dialog";
import { StoryboardDeliverableSection } from "@/components/storyboard/storyboard-deliverable-section";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardPanelMediaStrip } from "@/components/storyboard/storyboard-panel-media-strip";
import { StoryboardPanelEditDialog } from "@/components/storyboard/storyboard-panel-edit-dialog";
import { StoryboardSheetPreviewDialog } from "@/components/storyboard/storyboard-sheet-preview-dialog";
import { StoryboardRefUploader } from "@/components/storyboard/storyboard-ref-uploader";
import { FashionStepResults } from "@/components/fashion/fashion-step-results";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { FashionStoryboardSheetWorkspace } from "@/components/fashion/fashion-storyboard-sheet-workspace";
import {
  FashionCharacterRefChoiceDialog,
  type FashionCharacterRefChoice,
} from "@/components/fashion/fashion-character-ref-choice-dialog";
import { StoryboardSaveDialog } from "@/components/storyboard/storyboard-save-dialog";
import { StoryboardStepResults } from "@/components/storyboard/storyboard-step-results";
import { isFashionProject, buildFashionSellpointsSavePatch, buildFashionStoryboardPanelsSavePatch, resolveFashionDeliverable, buildFashionProjectKeywords, isFashionProduceSetupReady, fashionCharacterMode, fashionSheetNeedsScriptResync } from "@/lib/fashion-workflow";
import type { FashionCharacterRefMode } from "@/components/fashion/fashion-storyboard-sheet-workspace";
import type { FashionPanelRow, FashionSellpoint } from "@/lib/fashion-types";
import { asStoryboardDeliverable } from "@/lib/storyboard-deliverable-parse";
import type { StoryboardUploadRole } from "@/lib/storyboard-workflow";
import type { StoryboardSettingsValue } from "@/components/storyboard/storyboard-settings-dialog";
import {
  generateStoryboardPanelVideo,
  generateStoryboardSheetImage,
  getStoryboardProject,
  pollStoryboardFullVideoStatus,
  submitStoryboardFullVideo,
  renderStoryboardPanelVideos,
  waitStoryboardMediaRender,
  saveStoryboardDeliverableSnapshot,
  saveStoryboardWorkflow,
  syncStoryboardSheet,
  downloadStoryboardExportZip,
  updateStoryboardProject,
  uploadStoryboardSheetPng,
} from "@/lib/ecom-storyboard-api";
import type {
  StoryboardVideoResolution,
  StoryboardWanxSize,
} from "@/lib/storyboard-gen-params";
import {
  isStoryboardBailianR2vModel,
  aspectRatioFromR2vRatio,
  formatStoryboardVideoGenError,
  pickStoryboardVideoModelForFullSheetDuration,
  resolveSheetTotalDurationHintSec,
} from "@/lib/storyboard-video-params";
import {
  filterStoryboardBatchFailuresByPanelMedia,
  isStoryboardUpstreamTransportError,
  storyboardPanelHasMedia,
} from "@/lib/storyboard-batch-media-reconcile";
import { isStoryboardImageUrl, isStoryboardVideoUrl } from "@/lib/storyboard-media";
import {
  hasAllPanelImages,
  hasSheetImagesReady,
  hasStoryboardCharacterRef,
  hasStoryboardProductRef,
  STORYBOARD_CHARACTER_REF_REQUIRED_MESSAGE,
  willStoryboardAutoGenCharacter,
} from "@/lib/storyboard-workflow";
import type {
  StoryboardGatewayModel,
  StoryboardPanel,
  StoryboardProject,
  StoryboardReference,
  StoryboardSheet,
} from "@/lib/storyboard-types";
import {
  listStoryboardPendingPanelImageIndices,
  listStoryboardPendingPanelVideoIndices,
  resolveActiveStoryboardPanelVideoBusyIndices,
} from "@/lib/storyboard-pending-panels";
import { formatPanelPromptPreview } from "@/lib/storyboard-scene-prompt";

/** 整图成片前端轮询：间隔 4s × 240 ≈ 16 分钟（视频生成常超 6 分钟） */
const VIDEO_POLL_INTERVAL_MS = 4000;
const VIDEO_POLL_MAX_ITERS = 240;

type Props = {
  project: StoryboardProject;
  references: StoryboardReference[];
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onShareWorkflow?: () => void;
  onOpenSettings?: () => void;
  refBusy?: boolean;
  uploadRole?: StoryboardUploadRole;
  onUploadRoleChange?: (role: StoryboardUploadRole) => void;
  onRefUpload: (
    file: File,
    opts: { label: string; role: "character" | "product" | "scene" | "other" },
  ) => Promise<void>;
  onRefRemove: (refId: string) => void | Promise<void>;
  onAttachAssets: (
    assetIds: string[],
    role: StoryboardReference["role"],
  ) => void | Promise<void>;
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
  settings: StoryboardSettingsValue;
  onImageModelChange?: (key: string) => void;
  onVideoModelChange?: (key: string) => void;
  onImageSizeChange?: (v: StoryboardWanxSize) => void;
  onVideoResolutionChange?: (v: StoryboardVideoResolution) => void;
  onVideoR2vRatioChange?: (v: string) => void;
  onVideoSeedChange?: (v: string) => void;
  onVideoPromptExtendChange?: (v: boolean) => void;
  onVideoAspectChange?: (v: "16:9" | "9:16" | "1:1") => void;
  videoAspectRatio?: "16:9" | "9:16" | "1:1";
  videoOssUrl?: string | null;
  streaming?: boolean;
  onProjectChange: (p: StoryboardProject) => void;
  onDurationChange: (v: number) => void;
  onAspectChange: (v: "16:9" | "9:16") => void;
  onPngReady: (url: string) => void;
  onVideoReady: () => void;
  onPrepareExport?: (sheet: StoryboardSheet) => void;
  capturePng: () => Promise<string>;
  onPreviewVideo: (src: string, title?: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  /** 助手区点击「生成全部分镜图」时递增，触发模型选择 */
  generateAllImagesToken?: number;
  /** 助手区点击「生成整图成片」时递增，触发视频模型选择 */
  generateFullVideoToken?: number;
  /** 助手区点击「合并分镜视频」时递增 */
  mergePanelVideosToken?: number;
};

function schemeToSheet(
  project: StoryboardProject,
  schemeIndex: number,
): StoryboardSheet | null {
  const deliverable = asStoryboardDeliverable(project.meta?.deliverable);
  const scheme = deliverable?.schemes?.[schemeIndex];
  if (!scheme) return null;
  const params = deliverable?.params ?? {};
  const productHighlight =
    (typeof params.卖点 === "string" && params.卖点) ||
    (typeof params["核心卖点"] === "string" && params["核心卖点"]) ||
    scheme.strategy ||
    scheme.summary ||
    undefined;
  return {
    overview: {
      title: scheme.title,
      logline:
        scheme.summary ?? scheme.strategy ?? deliverable?.productName ?? "",
      productHighlight,
    },
    cast: [],
    panels: scheme.panels,
    totalDurationHintSec: scheme.totalDurationHintSec ?? 10,
  };
}

export function StoryboardContentPanel({
  project,
  references,
  durationSec,
  aspectRatio,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onShareWorkflow,
  onOpenSettings,
  refBusy = false,
  uploadRole = "product",
  onUploadRoleChange,
  onRefUpload,
  onRefRemove,
  onAttachAssets,
  imageModels,
  videoModels,
  settings,
  onImageModelChange,
  onVideoModelChange,
  onImageSizeChange,
  onVideoResolutionChange,
  onVideoR2vRatioChange,
  onVideoSeedChange,
  onVideoPromptExtendChange,
  videoAspectRatio = aspectRatio,
  onVideoAspectChange,
  videoOssUrl,
  streaming,
  onProjectChange,
  onDurationChange,
  onAspectChange,
  onPngReady,
  onVideoReady,
  onPrepareExport,
  capturePng,
  onPreviewVideo,
  onAlert,
  generateAllImagesToken,
  generateFullVideoToken,
  mergePanelVideosToken,
}: Props) {
  const router = useRouter();
  const [imgBusy, setImgBusy] = useState(() => {
    const pending = listStoryboardPendingPanelImageIndices(project.meta);
    const total = project.sheet?.panels.length ?? 0;
    return total > 0 && pending.length >= total;
  });
  const [sheetPngBusy, setSheetPngBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);
  const [videoTaskStartedAt, setVideoTaskStartedAt] = useState<string | null>(null);
  const [videoPollCount, setVideoPollCount] = useState(0);
  const videoPollLock = useRef(false);
  /** 已结束（失败/idle）的任务 id，防止 useEffect 反复自动轮询 */
  const videoPollDismissedTaskIdRef = useRef<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeBurnIn, setMergeBurnIn] = useState(false);
  const [mergeSubtitleStyle, setMergeSubtitleStyle] =
    useState<SubtitleBurnInStyle>(DEFAULT_SUBTITLE_STYLE);
  const [savingPanel, setSavingPanel] = useState(false);
  const [regeneratingPanels, setRegeneratingPanels] = useState<number[]>(() =>
    listStoryboardPendingPanelImageIndices(project.meta),
  );
  const [panelVidBusyPanels, setPanelVidBusyPanels] = useState<number[]>(() =>
    listStoryboardPendingPanelVideoIndices(project.meta),
  );
  const imageGenPollLockRef = useRef(false);
  const panelVideoPollLockRef = useRef(false);
  /** 本地发起的生图镜头（服务端 pending 写入前也保持 busy） */
  const imageGenWatchRef = useRef<number[]>([]);
  /** 当前 tab 内 HTTP 生图请求进行中（重生成时旧 imageUrl 不能当作已完成） */
  const imageGenInFlightRef = useRef(false);
  /** 本地发起的单镜视频（服务端 pending 写入前也保持 busy） */
  const panelVideoWatchRef = useRef<number[]>([]);
  const panelVideoInFlightRef = useRef(false);
  const regeneratingPanelsRef = useRef(regeneratingPanels);
  regeneratingPanelsRef.current = regeneratingPanels;

  const pendingPanelIndices = useMemo(
    () => listStoryboardPendingPanelImageIndices(project.meta),
    [project.meta],
  );

  const pendingPanelVideoIndices = useMemo(
    () => listStoryboardPendingPanelVideoIndices(project.meta),
    [project.meta],
  );

  const activeImageGenPanels = useMemo(() => {
    const set = new Set<number>([...regeneratingPanels, ...pendingPanelIndices]);
    return set;
  }, [pendingPanelIndices, regeneratingPanels]);

  const activePanelVideoPanels = useMemo(() => {
    return new Set(
      resolveActiveStoryboardPanelVideoBusyIndices({
        panelVidBusyPanels,
        pendingPanelVideoIndices,
        panels: project.sheet?.panels ?? [],
      }),
    );
  }, [panelVidBusyPanels, pendingPanelVideoIndices, project.sheet?.panels]);
  const imageModel = settings.imageModelKey;
  const videoModel = settings.videoModelKey;
  const [editPanelIndex, setEditPanelIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"image" | "video">("image");
  const [pendingPanelIndex, setPendingPanelIndex] = useState<number | null>(null);
  const [pendingVideoTarget, setPendingVideoTarget] = useState<"panel" | "fullSheet">("fullSheet");
  const [sheetPreviewOpen, setSheetPreviewOpen] = useState(false);
  const [deliverableReviewOpen, setDeliverableReviewOpen] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [fashionSellpointsSaving, setFashionSellpointsSaving] = useState(false);
  const [fashionPanelsSaving, setFashionPanelsSaving] = useState(false);
  const [fashionSheetSyncing, setFashionSheetSyncing] = useState(false);
  const [fashionSubmitBusy, setFashionSubmitBusy] = useState(false);
  const [fashionCharGenBusy, setFashionCharGenBusy] = useState(false);
  const pendingBatchPanelsRef = useRef<number[] | null>(null);
  const pendingBatchVideoPanelsRef = useRef<number[] | null>(null);
  const fashionImagePickerIntentRef = useRef<"generate" | "character">("generate");
  const fashionSheetResyncRef = useRef(false);
  /** 弹层刚选完角色方式时 project 可能尚未 re-render，生图时优先读此值 */
  const fashionResolvedCharModeRef = useRef<FashionCharacterRefChoice | null>(null);
  const fashionCharModeResolveRef = useRef<
    ((mode: FashionCharacterRefChoice | null) => void) | null
  >(null);
  const [fashionCharChoiceOpen, setFashionCharChoiceOpen] = useState(false);
  const { confirm, doubleConfirm } = useDialogs();
  const [exportBusy, setExportBusy] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveWorkflowBusy, setSaveWorkflowBusy] = useState(false);
  const panelImagePreviewItems = useMemo(
    () => buildStoryboardPanelPreviewItems(project.sheet?.panels ?? []),
    [project.sheet?.panels],
  );
  const {
    preview: imagePreview,
    openPreview: openPanelImagePreview,
    closePreview: closeImagePreview,
  } = useEcomImagePreview(panelImagePreviewItems);
  const [panelPromptPreview, setPanelPromptPreview] = useState<{
    title: string;
    prompt: string;
  } | null>(null);
  const [panelDurationSec, setPanelDurationSec] = useState(3);
  const [panelImageStripSelected, setPanelImageStripSelected] = useState<Set<number>>(
    () => new Set(),
  );
  const [panelVideoStripSelected, setPanelVideoStripSelected] = useState<Set<number>>(
    () => new Set(),
  );
  const imageSize = settings.imageSize;
  const videoResolution = settings.videoResolution;
  const videoR2vRatio = settings.videoR2vRatio ?? settings.aspectRatio ?? "9:16";
  const videoSeed = settings.videoSeed ?? "";
  const videoPromptExtend = settings.videoPromptExtend !== false;

  async function ensureFashionCharacterModeForGenerate(): Promise<
    FashionCharacterRefChoice | null
  > {
    const existing = fashionCharacterMode(project);
    if (existing) return existing;
    return new Promise((resolve) => {
      fashionCharModeResolveRef.current = resolve;
      setFashionCharChoiceOpen(true);
    });
  }

  async function ensureCharacterRefForMediaGen(
    fashionCharMode?: FashionCharacterRefChoice,
  ): Promise<boolean> {
    const wf = project.meta?.workflow ?? {};
    if (hasStoryboardCharacterRef(project)) return true;
    if (willStoryboardAutoGenCharacter(project, fashionCharMode)) return true;
    if (wf.skippedCharacter) {
      return confirm({
        title: "未绑定角色参考图",
        message:
          "当前项目跳过了角色图步骤，各镜头人物可能不一致。是否仍继续生成？",
      });
    }
    await onAlert({
      title: "缺少角色参考图",
      message: STORYBOARD_CHARACTER_REF_REQUIRED_MESSAGE,
      variant: "error",
    });
    return false;
  }

  function closeFashionCharChoiceDialog() {
    setFashionCharChoiceOpen(false);
    fashionCharModeResolveRef.current?.(null);
    fashionCharModeResolveRef.current = null;
  }

  async function handleFashionCharChoice(choice: FashionCharacterRefChoice) {
    setFashionCharChoiceOpen(false);
    fashionCharModeResolveRef.current?.(choice);
    fashionCharModeResolveRef.current = null;
  }

  async function runFashionImageGeneration(opts: {
    panelIndex?: number;
    batchIndexes?: number[];
    modelKeyOverride?: string;
  }) {
    const { panelIndex, batchIndexes, modelKeyOverride } = opts;
    if (!hasStoryboardProductRef(project)) {
      await onAlert({
        title: "缺少产品图",
        message: "生成分镜图前须先上传产品图（必填）。",
        variant: "error",
      });
      return;
    }

    const charMode = await ensureFashionCharacterModeForGenerate();
    if (!charMode) return;
    fashionResolvedCharModeRef.current = charMode;

    if (fashionCharacterMode(project) !== charMode) {
      await persistFashionProduceWorkflow({
        fashionCharacterMode: charMode,
        ...(charMode === "ai" || references.some((r) => r.role === "character")
          ? { fashionProduceSetupPending: false }
          : {}),
      });
      if (charMode === "upload") {
        onUploadRoleChange?.("character");
      }
    }

    const hasCharRef = references.some((r) => r.role === "character");
    if (charMode === "upload" && !hasCharRef) {
      await onAlert({
        title: "请上传角色图",
        message: "已选择「自行上传」。请在左侧素材区上传角色参考图，上传完成后再次点击生成分镜图。",
      });
      return;
    }

    const modelKey = modelKeyOverride?.trim() || "";
    if (!modelKey) {
      openImagePicker(panelIndex, batchIndexes, "generate");
      return;
    }

    if (batchIndexes && batchIndexes.length > 0) {
      await handleGenerateImagesBatch(batchIndexes, modelKey, charMode);
      return;
    }
    await handleGenerateImage(panelIndex, modelKey, charMode);
  }

  function beginFashionImageGeneration(opts: {
    panelIndex?: number;
    batchIndexes?: number[];
  }) {
    void runFashionImageGeneration(opts);
  }

  function openImagePicker(
    panelIndex?: number,
    batchIndexes?: number[],
    intent: "generate" | "character" = "generate",
  ) {
    setPickerMode("image");
    setPendingPanelIndex(panelIndex ?? null);
    pendingBatchPanelsRef.current =
      batchIndexes && batchIndexes.length > 0 ? batchIndexes : null;
    fashionImagePickerIntentRef.current = intent;
    setPickerOpen(true);
  }

  async function persistFashionProduceWorkflow(patch: Record<string, unknown>) {
    const updated = await updateStoryboardProject(project.id, {
      meta: {
        ...project.meta,
        workflow: {
          ...(project.meta?.workflow ?? {}),
          vertical: "fashion_apparel",
          ...patch,
        },
      },
    });
    onProjectChange(updated);
  }

  const syncGeneratingPanelImages = useCallback(async () => {
    if (imageGenPollLockRef.current) return;
    imageGenPollLockRef.current = true;
    try {
      const fresh = await getStoryboardProject(project.id);
      onProjectChange(fresh);
      const pending = listStoryboardPendingPanelImageIndices(fresh.meta);
      const watch = new Set<number>([
        ...imageGenWatchRef.current,
        ...pending,
      ]);
      if (watch.size === 0 && !imageGenInFlightRef.current) return;

      const total = fresh.sheet?.panels.length ?? 0;
      const batchWatch = total > 0 && imageGenWatchRef.current.length >= total;
      const stillRunning =
        imageGenInFlightRef.current || pending.length > 0;

      const active = new Set<number>(pending);
      if (imageGenInFlightRef.current) {
        for (const idx of imageGenWatchRef.current) active.add(idx);
      }
      for (const idx of [...active]) {
        const done = fresh.sheet?.panels.some(
          (p) => p.index === idx && Boolean(p.imageUrl),
        );
        if (done && !imageGenInFlightRef.current) {
          active.delete(idx);
        }
      }
      setRegeneratingPanels([...active].sort((a, b) => a - b));

      if (!stillRunning) {
        imageGenWatchRef.current = [];
        setImgBusy(false);
        setRegeneratingPanels([]);
      } else {
        setImgBusy(batchWatch || (total > 0 && pending.length >= total));
      }
    } catch {
      /* ignore transient poll errors */
    } finally {
      imageGenPollLockRef.current = false;
    }
  }, [onProjectChange, project.id]);

  useEffect(() => {
    const pending = listStoryboardPendingPanelImageIndices(project.meta);
    imageGenWatchRef.current = pending;
    setRegeneratingPanels(pending);
    const total = project.sheet?.panels.length ?? 0;
    setImgBusy(total > 0 && pending.length >= total);
    void syncGeneratingPanelImages();
  }, [project.id, syncGeneratingPanelImages]);

  useEffect(() => {
    const pending = listStoryboardPendingPanelImageIndices(project.meta);
    if (pending.length === 0) return;
    setRegeneratingPanels((prev) =>
      [...new Set([...prev, ...pending])].sort((a, b) => a - b),
    );
    const total = project.sheet?.panels.length ?? 0;
    if (total > 0 && pending.length >= total) setImgBusy(true);
  }, [project.meta, project.sheet?.panels.length]);

  useEffect(() => {
    const pendingCount = pendingPanelIndices.length;
    if (pendingCount === 0 && activeImageGenPanels.size === 0 && !imgBusy) return;
    void syncGeneratingPanelImages();
    const timer = window.setInterval(() => {
      void syncGeneratingPanelImages();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [
    pendingPanelIndices.length,
    activeImageGenPanels.size,
    imgBusy,
    syncGeneratingPanelImages,
  ]);

  const syncGeneratingPanelVideos = useCallback(async () => {
    if (panelVideoPollLockRef.current) return;
    panelVideoPollLockRef.current = true;
    try {
      const fresh = await getStoryboardProject(project.id);
      onProjectChange(fresh);
      const pending = listStoryboardPendingPanelVideoIndices(fresh.meta);
      const watch = new Set<number>([...panelVideoWatchRef.current, ...pending]);
      if (watch.size === 0 && !panelVideoInFlightRef.current) return;

      const stillRunning = panelVideoInFlightRef.current || pending.length > 0;

      const active = new Set<number>(pending);
      if (panelVideoInFlightRef.current) {
        for (const idx of panelVideoWatchRef.current) active.add(idx);
      }
      for (const idx of [...active]) {
        const done = fresh.sheet?.panels.some(
          (p) => p.index === idx && Boolean(p.videoUrl?.trim()),
        );
        if (done && !panelVideoInFlightRef.current) {
          active.delete(idx);
        }
      }
      setPanelVidBusyPanels([...active].sort((a, b) => a - b));

      if (!stillRunning) {
        panelVideoWatchRef.current = [];
        setPanelVidBusyPanels([]);
      }
    } catch {
      /* ignore transient poll errors */
    } finally {
      panelVideoPollLockRef.current = false;
    }
  }, [onProjectChange, project.id]);

  useEffect(() => {
    const pending = listStoryboardPendingPanelVideoIndices(project.meta);
    panelVideoWatchRef.current = pending;
    setPanelVidBusyPanels(pending);
    void syncGeneratingPanelVideos();
  }, [project.id, syncGeneratingPanelVideos]);

  useEffect(() => {
    const pending = listStoryboardPendingPanelVideoIndices(project.meta);
    if (pending.length === 0) return;
    const panels = project.sheet?.panels ?? [];
    const stillPending = pending.filter(
      (idx) =>
        !panels.some((p) => p.index === idx && Boolean(p.videoUrl?.trim())),
    );
    if (stillPending.length === 0) return;
    setPanelVidBusyPanels((prev) =>
      [...new Set([...prev, ...stillPending])].sort((a, b) => a - b),
    );
  }, [project.meta, project.sheet?.panels]);

  useEffect(() => {
    if (pendingPanelVideoIndices.length === 0 && panelVidBusyPanels.length === 0) {
      return;
    }
    void syncGeneratingPanelVideos();
    const timer = window.setInterval(() => {
      void syncGeneratingPanelVideos();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [
    pendingPanelVideoIndices.length,
    panelVidBusyPanels.length,
    syncGeneratingPanelVideos,
  ]);

  function togglePanelImageStripSelect(panelIndex: number) {
    setPanelImageStripSelected((prev) => {
      const next = new Set(prev);
      if (next.has(panelIndex)) next.delete(panelIndex);
      else next.add(panelIndex);
      return next;
    });
  }

  function togglePanelVideoStripSelect(panelIndex: number) {
    setPanelVideoStripSelected((prev) => {
      const next = new Set(prev);
      if (next.has(panelIndex)) next.delete(panelIndex);
      else next.add(panelIndex);
      return next;
    });
  }

  function openVideoPicker(opts: {
    panelIndex?: number;
    fullSheet?: boolean;
    batchIndexes?: number[];
  }) {
    if (opts.fullSheet && vidBusy) return;
    setPickerMode("video");
    const batch =
      opts.batchIndexes && opts.batchIndexes.length > 0 ? opts.batchIndexes : null;
    pendingBatchVideoPanelsRef.current = batch;
    setPendingPanelIndex(batch?.[0] ?? opts.panelIndex ?? null);
    setPendingVideoTarget(opts.fullSheet ? "fullSheet" : "panel");
    if (opts.fullSheet && project.sheet) {
      const hint = resolveSheetTotalDurationHintSec(project.sheet);
      if (hint != null) {
        onDurationChange(hint);
        const nextModel = pickStoryboardVideoModelForFullSheetDuration(
          videoModels,
          hint,
          videoModel,
        );
        if (nextModel !== videoModel) {
          onVideoModelChange?.(nextModel);
        }
      }
    } else if (typeof opts.panelIndex === "number" && project.sheet) {
      const panel = project.sheet.panels.find((p) => p.index === opts.panelIndex);
      setPanelDurationSec(Math.max(2, Math.round(panel?.durationHintSec ?? 3)));
    } else if (batch?.length && project.sheet) {
      const panel = project.sheet.panels.find((p) => p.index === batch[0]);
      setPanelDurationSec(Math.max(2, Math.round(panel?.durationHintSec ?? 3)));
    }
    setPickerOpen(true);
  }

  function openVideoPickerForPanelIndexes(indexes: number[]) {
    const withImages = indexes.filter((index) => {
      const p = project.sheet?.panels.find((item) => item.index === index);
      return Boolean(p?.imageUrl?.trim());
    });
    if (withImages.length === 0) {
      void onAlert({
        title: "提示",
        message: "请先生成选中镜头的分镜图，再生成视频。",
      });
      return;
    }
    if (withImages.length === 1) {
      openVideoPicker({ panelIndex: withImages[0] });
      return;
    }
    openVideoPicker({ batchIndexes: withImages, panelIndex: withImages[0] });
  }

  async function waitForExportImages() {
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    const el = document.getElementById("storyboard-sheet-export");
    if (!el) return;
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            setTimeout(done, 4000);
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 300));
  }

  const deliverable = asStoryboardDeliverable(project.meta?.deliverable);
  const schemes = deliverable?.schemes ?? [];
  const selectedIndex = project.meta?.selectedSchemeIndex ?? 0;
  const hasSheetImages = hasSheetImagesReady(project);

  function pickProjectKeywords(): string | undefined {
    const params = deliverable?.params ?? {};
    return (
      (typeof params["关键词"] === "string" && params["关键词"]) ||
      (typeof params.keywords === "string" && params.keywords) ||
      (typeof params["项目关键词"] === "string" && params["项目关键词"]) ||
      deliverable?.productName ||
      undefined
    );
  }

  async function adoptScheme(index: number) {
    const sheet = schemeToSheet(project, index);
    if (!sheet) return;
    const updated = await updateStoryboardProject(project.id, {
      sheet,
      meta: { ...project.meta, selectedSchemeIndex: index },
      settings: {
        ...project.settings,
        durationSec: sheet.totalDurationHintSec ?? durationSec,
      },
    });
    onProjectChange(updated);
    if (sheet.totalDurationHintSec) onDurationChange(sheet.totalDurationHintSec);
  }

  async function ensureSheetReady(): Promise<boolean> {
    if (project.sheet) return true;

    if (isFashionProject(project)) {
      try {
        const updated = await syncStoryboardSheet(project.id);
        onProjectChange(updated);
        return Boolean(updated.sheet);
      } catch {
        return false;
      }
    }

    const schemes = deliverable?.schemes ?? [];
    if (schemes.length > 1 && !project.meta?.workflow?.schemePicked) {
      return false;
    }
    const sheet = schemeToSheet(project, selectedIndex);
    if (sheet) {
      const updated = await updateStoryboardProject(project.id, {
        sheet,
        meta: { ...project.meta, selectedSchemeIndex: selectedIndex },
      });
      onProjectChange(updated);
      return true;
    }
    try {
      const updated = await syncStoryboardSheet(project.id, {
        schemeIndex: selectedIndex,
      });
      onProjectChange(updated);
      return Boolean(updated.sheet);
    } catch {
      return false;
    }
  }

  async function compositeSheetPng(
    nextSheet: StoryboardSheet,
    nextReferences?: StoryboardReference[],
  ) {
    setSheetPngBusy(true);
    try {
      onProjectChange({
        ...project,
        sheet: nextSheet,
        references: nextReferences ?? project.references,
      });
      onPrepareExport?.(nextSheet);
      await waitForExportImages();
      const b64 = await capturePng();
      const url = await uploadStoryboardSheetPng(project.id, b64);
      onPngReady(url);
    } finally {
      setSheetPngBusy(false);
    }
  }

  async function handleGenerateImage(
    panelIndex?: number,
    modelKeyOverride?: string,
    fashionCharModeOverride?: FashionCharacterRefChoice,
    runtimeOpts?: {
      /** 批量并发时由外层统一维护 busy 态 */
      deferBusy?: boolean;
      quietSuccess?: boolean;
      quietError?: boolean;
      skipProjectUpdate?: boolean;
      skipComposite?: boolean;
      skipAutoRefresh?: boolean;
      autoGenCharacterOverride?: boolean;
      /** 批量外层已校验 sheet 就绪 */
      skipSheetReadyCheck?: boolean;
      /** 批量外层已校验角色参考 */
      skipCharacterRefCheck?: boolean;
      /** 批量并发内层调用，跳过重复前置校验 */
      batchInner?: boolean;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!runtimeOpts?.batchInner) {
      if (!hasStoryboardProductRef(project)) {
        const message = "生成分镜图前须先上传产品图（必填）。";
        if (!runtimeOpts?.quietError) {
          await onAlert({
            title: "缺少产品图",
            message,
            variant: "error",
          });
        }
        return { ok: false, error: message };
      }
      const charMode =
        fashionCharModeOverride ??
        fashionResolvedCharModeRef.current ??
        fashionCharacterMode(project);
      if (
        isFashionProject(project) &&
        resolveFashionDeliverable(project)?.outputMode === "direct_video" &&
        !charMode
      ) {
        const message = "请通过生成分镜图流程选择「自行上传」或「AI 生成」角色参考。";
        if (!runtimeOpts?.quietError) {
          await onAlert({
            title: "请先选择角色参考方式",
            message,
          });
        }
        return { ok: false, error: message };
      }
      const hasCharRef = references.some((r) => r.role === "character");
      if (
        isFashionProject(project) &&
        charMode === "upload" &&
        !hasCharRef
      ) {
        const message = "已选择「上传角色图」，请先在左侧素材区上传角色参考图。";
        if (!runtimeOpts?.quietError) {
          await onAlert({
            title: "缺少角色图",
            message,
            variant: "error",
          });
        }
        return { ok: false, error: message };
      }
      if (!runtimeOpts?.skipCharacterRefCheck) {
        if (!(await ensureCharacterRefForMediaGen(charMode))) {
          return { ok: false, error: "缺少角色参考图" };
        }
      }
    }
    const charMode =
      fashionCharModeOverride ??
      fashionResolvedCharModeRef.current ??
      fashionCharacterMode(project);
    const modelKey = modelKeyOverride?.trim() || imageModel;
    const watchIndexes =
      typeof panelIndex === "number"
        ? [panelIndex]
        : (project.sheet?.panels.map((p) => p.index) ?? []);
    if (!runtimeOpts?.deferBusy) {
      imageGenWatchRef.current = watchIndexes;
      imageGenInFlightRef.current = true;
      setRegeneratingPanels(watchIndexes);
      if (typeof panelIndex !== "number") {
        setImgBusy(true);
      }
    }
    try {
      if (!runtimeOpts?.skipSheetReadyCheck) {
        const ready = await ensureSheetReady();
        if (!ready) {
          const message = isFashionProject(project)
            ? "故事版分镜表尚未同步到工作台。请稍候自动同步完成，或刷新页面后在中间「故事版 · 成片工作区」点「生成全部分镜图」；仍失败请重新在右侧选择「故事版一键成片」。"
            : schemes.length > 1 && !project.meta?.workflow?.schemePicked
              ? "请先选定一套分镜方案（右侧或助手上方按钮），上传参考图并回复「定稿」后再生图。"
              : "当前仅有文本交付，缺少结构化分镜。请让助手重新输出完整方案，或回复「定稿」采用所选方案。";
          if (!runtimeOpts?.deferBusy) {
            imageGenWatchRef.current = [];
            imageGenInFlightRef.current = false;
            setRegeneratingPanels([]);
            setImgBusy(false);
          }
          if (!runtimeOpts?.quietError) {
            await onAlert({
              title: "无法生图",
              message,
            });
          }
          return { ok: false, error: message };
        }
      }
      const wf = project.meta?.workflow ?? {};
      const fashionAutoChar = isFashionProject(project) && charMode === "ai";
      const autoGenCharacter =
        runtimeOpts?.autoGenCharacterOverride ??
        (fashionAutoChar ||
          Boolean(wf.autoGenCharacter) ||
          Boolean(wf.characterPresetKey));
      const { sheet: nextSheet, references: nextRefs } = await generateStoryboardSheetImage(
        project.id,
        {
          modelKey,
          aspectRatio,
          imageSize,
          panelIndex,
          autoGenCharacter,
        },
      );
      const allReady = nextSheet.panels.every((p) => Boolean(p.imageUrl));
      if (!runtimeOpts?.skipProjectUpdate) {
        if (allReady && !runtimeOpts?.skipComposite) {
          await compositeSheetPng(nextSheet, nextRefs);
        } else {
          onProjectChange({
            ...project,
            sheet: nextSheet,
            references: nextRefs ?? project.references,
          });
        }
      }
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "分镜图生成失败";
      if (isStoryboardUpstreamTransportError(message)) {
        try {
          const refreshed = await getStoryboardProject(project.id);
          if (
            storyboardPanelHasMedia(refreshed.sheet?.panels ?? [], panelIndex, "image")
          ) {
            if (!runtimeOpts?.skipProjectUpdate) {
              onProjectChange(refreshed);
            }
            return { ok: true };
          }
        } catch {
          /* 仍按传输失败处理 */
        }
      }
      if (!runtimeOpts?.quietError) {
        await onAlert({
          title: "生成失败",
          message,
          variant: "error",
        });
      }
      return { ok: false, error: message };
    } finally {
      if (!runtimeOpts?.skipAutoRefresh && !runtimeOpts?.deferBusy) {
        imageGenInFlightRef.current = false;
        try {
          const refreshed = await getStoryboardProject(project.id);
          onProjectChange(refreshed);
          const pending = listStoryboardPendingPanelImageIndices(refreshed.meta);
          const total = refreshed.sheet?.panels.length ?? 0;
          if (pending.length > 0) {
            imageGenWatchRef.current = pending;
            setRegeneratingPanels(pending);
            setImgBusy(total > 0 && pending.length >= total);
          } else {
            imageGenWatchRef.current = [];
            setRegeneratingPanels([]);
            setImgBusy(false);
          }
        } catch {
          if (!imageGenInFlightRef.current && imageGenWatchRef.current.length === 0) {
            setImgBusy(false);
            setRegeneratingPanels([]);
          }
        }
      }
    }
  }

  async function handleGenerateImagesBatch(
    panelIndexes: number[],
    modelKeyOverride?: string,
    fashionCharModeOverride?: FashionCharacterRefChoice,
  ) {
    const queue = [...new Set(panelIndexes)]
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    if (queue.length === 0) return;
    if (queue.length === 1) {
      await handleGenerateImage(queue[0], modelKeyOverride, fashionCharModeOverride);
      return;
    }

    if (!hasStoryboardProductRef(project)) {
      await onAlert({
        title: "缺少产品图",
        message: "生成分镜图前须先上传产品图（必填）。",
        variant: "error",
      });
      return;
    }

    const charMode =
      fashionCharModeOverride ??
      fashionResolvedCharModeRef.current ??
      fashionCharacterMode(project);
    if (
      isFashionProject(project) &&
      resolveFashionDeliverable(project)?.outputMode === "direct_video" &&
      !charMode
    ) {
      await onAlert({
        title: "请先选择角色参考方式",
        message: "请通过生成分镜图流程选择「自行上传」或「AI 生成」角色参考。",
      });
      return;
    }
    const hasCharRef = references.some((r) => r.role === "character");
    if (
      isFashionProject(project) &&
      charMode === "upload" &&
      !hasCharRef
    ) {
      await onAlert({
        title: "缺少角色图",
        message: "已选择「上传角色图」，请先在左侧素材区上传角色参考图。",
        variant: "error",
      });
      return;
    }
    if (!(await ensureCharacterRefForMediaGen(charMode))) {
      return;
    }
    const ready = await ensureSheetReady();
    if (!ready) {
      await onAlert({
        title: "无法生图",
        message: isFashionProject(project)
          ? "故事版分镜表尚未同步到工作台。请稍候自动同步完成，或刷新页面后在中间「故事版 · 成片工作区」点「生成全部分镜图」；仍失败请重新在右侧选择「故事版一键成片」。"
          : schemes.length > 1 && !project.meta?.workflow?.schemePicked
            ? "请先选定一套分镜方案（右侧或助手上方按钮），上传参考图并回复「定稿」后再生图。"
            : "当前仅有文本交付，缺少结构化分镜。请让助手重新输出完整方案，或回复「定稿」采用所选方案。",
      });
      return;
    }

    const modelKey = modelKeyOverride?.trim() || imageModel;
    const wf = project.meta?.workflow ?? {};
    const fashionAutoChar = isFashionProject(project) && charMode === "ai";
    const shouldAutoGenCharacter =
      !hasCharRef &&
      !wf.skippedCharacter &&
      (fashionAutoChar ||
        Boolean(wf.autoGenCharacter) ||
        Boolean(wf.characterPresetKey));

    if (shouldAutoGenCharacter) {
      try {
        const { references: nextRefs } = await generateStoryboardSheetImage(project.id, {
          modelKey,
          aspectRatio,
          imageSize,
          autoGenCharacter: true,
          characterOnly: true,
        });
        onProjectChange({
          ...project,
          references: nextRefs ?? project.references,
        });
      } catch (e) {
        await onAlert({
          title: "角色图生成失败",
          message:
            e instanceof Error
              ? e.message
              : "批量生图前需先生成角色参考图，请重试或改用手动上传。",
          variant: "error",
        });
        return;
      }
    }

    imageGenWatchRef.current = queue;
    imageGenInFlightRef.current = true;
    setRegeneratingPanels(queue);
    const failures: { index: number; message: string }[] = [];
    let latestPanels = project.sheet?.panels ?? [];
    try {
      await Promise.all(
        queue.map(async (panelIndex) => {
          const result = await handleGenerateImage(
            panelIndex,
            modelKey,
            charMode ?? undefined,
            {
              deferBusy: true,
              quietSuccess: true,
              quietError: true,
              skipProjectUpdate: true,
              skipComposite: true,
              skipAutoRefresh: true,
              autoGenCharacterOverride: false,
              skipSheetReadyCheck: true,
              skipCharacterRefCheck: true,
              batchInner: true,
            },
          );
          if (result?.ok) {
            try {
              const refreshed = await getStoryboardProject(project.id);
              onProjectChange(refreshed);
              latestPanels = refreshed.sheet?.panels ?? latestPanels;
            } catch {
              /* ignore transient reload errors */
            }
          } else {
            failures.push({ index: panelIndex, message: result?.error ?? "生成失败" });
          }
        }),
      );
      try {
        const refreshed = await getStoryboardProject(project.id);
        onProjectChange(refreshed);
        latestPanels = refreshed.sheet?.panels ?? latestPanels;
        if (refreshed.sheet?.panels.every((p) => Boolean(p.imageUrl))) {
          await compositeSheetPng(refreshed.sheet, refreshed.references ?? references);
        }
      } catch {
        /* 单镜已成功时仍尽量保留本地 sheet 更新 */
      }
    } finally {
      imageGenInFlightRef.current = false;
      imageGenWatchRef.current = [];
      setRegeneratingPanels([]);
      setImgBusy(false);
      void syncGeneratingPanelImages();
    }

    const reconciledFailures = filterStoryboardBatchFailuresByPanelMedia(
      failures,
      latestPanels,
      "image",
    );
    reconciledFailures.sort((a, b) => a.index - b.index);
    if (reconciledFailures.length === 0) {
      await onAlert({
        title: "批量完成",
        message: `已生成 ${queue.length} 镜分镜图。`,
      });
      return;
    }
    if (reconciledFailures.length < queue.length) {
      await onAlert({
        title: "部分镜头失败",
        message: reconciledFailures.map((f) => `镜头 ${f.index}：${f.message}`).join("\n"),
        variant: "error",
      });
      return;
    }
    await onAlert({
      title: "生成失败",
      message: reconciledFailures[0]?.message ?? "分镜图生成失败",
      variant: "error",
    });
  }

  async function handlePanelSave(updatedPanel: StoryboardSheet["panels"][0]) {
    if (!project.sheet) return;
    setSavingPanel(true);
    try {
      const panels = project.sheet.panels.map((p) =>
        p.index === updatedPanel.index
          ? { ...updatedPanel, imageUrl: undefined, videoUrl: undefined }
          : p,
      );
      const updated = await updateStoryboardProject(project.id, {
        sheet: { ...project.sheet, panels },
        sheetPngUrl: null,
      });
      onProjectChange(updated);
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "镜头保存失败",
        variant: "error",
      });
      throw e;
    } finally {
      setSavingPanel(false);
    }
  }

  const dismissVideoPoll = useCallback(
    (taskId?: string | null) => {
      videoPollDismissedTaskIdRef.current = taskId?.trim() || "__dismissed__";
      setVideoTaskStartedAt(null);
      onVideoReady();
    },
    [onVideoReady],
  );

  const pollFullVideoUntilDone = useCallback(async () => {
    if (videoPollLock.current) return;
    const activeTaskId = project.meta?.workflow?.pendingFullVideoJob?.taskId;
    if (
      activeTaskId &&
      videoPollDismissedTaskIdRef.current === activeTaskId
    ) {
      return;
    }
    videoPollLock.current = true;
    setVidBusy(true);
    let sessionRefreshing = false;
    let failMessage: string | null = null;
    let pollEnded = false;
    try {
      if (!(await ensureEcomSessionFresh(90, { redirectOnFailure: true }))) {
        sessionRefreshing = true;
        return;
      }

      for (let i = 0; i < VIDEO_POLL_MAX_ITERS; i++) {
        setVideoPollCount(i + 1);

        if (i > 0 && i % 8 === 0) {
          if (!(await ensureEcomSessionFresh(90, { redirectOnFailure: true }))) {
            sessionRefreshing = true;
            return;
          }
        }

        let polled;
        try {
          polled = await pollStoryboardFullVideoStatus(project.id);
        } catch (e) {
          if (isEcomUnauthorizedError(e)) {
            sessionRefreshing = true;
            redirectEcomSessionRefresh();
            return;
          }
          failMessage = e instanceof Error ? e.message : "视频生成失败";
          dismissVideoPoll(activeTaskId);
          pollEnded = true;
          break;
        }

        if (polled.status === "succeeded") {
          const ossUrl = polled.videoOssUrl ?? polled.asset?.ossUrl;
          if (ossUrl) {
            onProjectChange({
              ...project,
              videoOssUrl: ossUrl,
              videoAssetId: polled.asset.id,
            });
          }
          videoPollDismissedTaskIdRef.current = null;
          onVideoReady();
          setVideoTaskStartedAt(null);
          await onAlert({
            title: "整图成片已生成",
            message: `${durationSec}s · ${videoResolution} 带货视频已保存，并已自动保存交付快照。`,
          });
          return;
        }
        if (polled.status === "idle") {
          dismissVideoPoll(activeTaskId);
          pollEnded = true;
          break;
        }
        if (polled.startedAt) {
          setVideoTaskStartedAt(polled.startedAt);
        }

        await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
      }

      if (failMessage) {
        await onAlert({
          title: "生成失败",
          message: failMessage,
          variant: "error",
        });
      } else if (!pollEnded) {
        // 仅前端轮询超时：Gateway 任务仍在后台进行，结果可恢复，不算失败。
        // 标记本任务不再自动轮询，由用户点「刷新」恢复（避免重复生成重复计费）。
        videoPollDismissedTaskIdRef.current = activeTaskId ?? "__pending__";
        setVideoTaskStartedAt(null);
        await onAlert({
          title: "仍在生成中",
          message:
            "视频生成耗时较长，任务仍在后台进行。完成后点「刷新」即可获取结果，无需重新生成（重复生成会重复计费）。",
        });
      }
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        sessionRefreshing = true;
        redirectEcomSessionRefresh();
        return;
      }
      dismissVideoPoll(activeTaskId);
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "视频生成失败",
        variant: "error",
      });
    } finally {
      if (!sessionRefreshing) {
        videoPollLock.current = false;
        setVidBusy(false);
        setVideoPollCount(0);
      }
    }
  }, [
    dismissVideoPoll,
    durationSec,
    onAlert,
    onProjectChange,
    onVideoReady,
    project,
    videoResolution,
  ]);

  useEffect(() => {
    const pending = project.meta?.workflow?.pendingFullVideoJob;
    if (!pending?.taskId || !pending.startedAt) return;
    if (videoPollDismissedTaskIdRef.current === pending.taskId) return;
    if (vidBusy || videoPollLock.current) return;
    setVideoTaskStartedAt(pending.startedAt);
    void pollFullVideoUntilDone();
  }, [project.meta?.workflow?.pendingFullVideoJob?.taskId, pollFullVideoUntilDone, vidBusy]);

  /** 刷新：重载项目；恢复分镜图 pending 轮询与整图成片任务 */
  const handleReloadProject = useCallback(async () => {
    onVideoReady();
    try {
      const fresh = await getStoryboardProject(project.id);
      onProjectChange(fresh);
      const pending = listStoryboardPendingPanelImageIndices(fresh.meta);
      imageGenWatchRef.current = pending;
      setRegeneratingPanels(pending);
      const total = fresh.sheet?.panels.length ?? 0;
      setImgBusy(total > 0 && pending.length >= total);
      const pendingVideos = listStoryboardPendingPanelVideoIndices(fresh.meta);
      setPanelVidBusyPanels(pendingVideos);
    } catch {
      /* ignore transient reload errors */
    }
    const pendingVideo = project.meta?.workflow?.pendingFullVideoJob;
    if (pendingVideo?.taskId && !vidBusy && !videoPollLock.current) {
      videoPollDismissedTaskIdRef.current = null;
      void pollFullVideoUntilDone();
    }
  }, [onProjectChange, onVideoReady, pollFullVideoUntilDone, project.id, project.meta?.workflow?.pendingFullVideoJob, vidBusy]);

  const fashionSheetSyncRef = useRef(false);
  const fashionOutputMode = resolveFashionDeliverable(project)?.outputMode;

  useEffect(() => {
    if (!isFashionProject(project)) return;
    if (fashionOutputMode !== "direct_video" || project.sheet) return;
    if (fashionSheetSyncRef.current) return;
    fashionSheetSyncRef.current = true;
    void syncStoryboardSheet(project.id)
      .then((updated) => {
        onProjectChange(updated);
      })
      .catch(async (e) => {
        await onAlert({
          title: "故事版同步失败",
          message: e instanceof Error ? e.message : "请在中栏点「重新同步故事版」重试",
          variant: "error",
        });
      })
      .finally(() => {
        fashionSheetSyncRef.current = false;
      });
  }, [project.id, project.sheet, fashionOutputMode, onProjectChange, onAlert, project]);

  const generateAllImagesTokenRef = useRef(0);
  useEffect(() => {
    if (!generateAllImagesToken || generateAllImagesToken <= generateAllImagesTokenRef.current) {
      return;
    }
    generateAllImagesTokenRef.current = generateAllImagesToken;
    void (async () => {
      if (!project.sheet) {
        const ready = await ensureSheetReady();
        if (!ready) return;
      }
      if (
        isFashionProject(project) &&
        resolveFashionDeliverable(project)?.outputMode === "direct_video"
      ) {
        beginFashionImageGeneration({});
        return;
      }
      openImagePicker();
    })();
  }, [generateAllImagesToken, project.sheet]);

  const generateFullVideoTokenRef = useRef(0);
  useEffect(() => {
    if (!generateFullVideoToken || generateFullVideoToken <= generateFullVideoTokenRef.current) {
      return;
    }
    generateFullVideoTokenRef.current = generateFullVideoToken;
    if (!hasSheetImagesReady(project)) {
      void onAlert({
        title: "提示",
        message: "请先在右侧生成全部分镜图。",
      });
      return;
    }
    openVideoPicker({ fullSheet: true });
  }, [generateFullVideoToken, project, onAlert]);

  const mergePanelVideosTokenRef = useRef(0);
  useEffect(() => {
    if (!mergePanelVideosToken || mergePanelVideosToken <= mergePanelVideosTokenRef.current) {
      return;
    }
    mergePanelVideosTokenRef.current = mergePanelVideosToken;
    void handleMergePanelVideos();
  }, [mergePanelVideosToken]);

  async function ensureSheetPngForVideo(): Promise<boolean> {
    if (!hasAllPanelImages(project) || !project.sheet) {
      await onAlert({ title: "提示", message: "请先生成全部分镜图。" });
      return false;
    }
    setSheetPngBusy(true);
    try {
      onPrepareExport?.(project.sheet);
      await waitForExportImages();
      const b64 = await capturePng();
      const url = await uploadStoryboardSheetPng(project.id, b64);
      onPngReady(url);
      return true;
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        redirectEcomSessionRefresh();
        return false;
      }
      await onAlert({
        title: "合成失败",
        message:
          e instanceof Error
            ? e.message
            : "完整分镜图 PNG 合成失败，无法整图成片。",
        variant: "error",
      });
      return false;
    } finally {
      setSheetPngBusy(false);
    }
  }

  async function handleGenerateFullVideo(modelKeyOverride?: string) {
    if (vidBusy) return;
    if (!hasAllPanelImages(project) || !project.sheet) {
      await onAlert({ title: "提示", message: "请先生成全部分镜图。" });
      return;
    }
    const effectiveModel = modelKeyOverride?.trim() || videoModel;
    setVidBusy(true);
    setVideoPollCount(0);
    try {
      videoPollDismissedTaskIdRef.current = null;
      const submitted = await submitStoryboardFullVideo(project.id, {
        durationSec,
        aspectRatio: videoAspectRatio,
        resolution: videoResolution,
        modelKey: effectiveModel,
        ...(isStoryboardBailianR2vModel(effectiveModel)
          ? {
              ratio: videoR2vRatio,
              seedStr: videoSeed.trim() || undefined,
              promptExtend: videoPromptExtend,
            }
          : {}),
      });
      setVideoTaskStartedAt(submitted.startedAt);
      await pollFullVideoUntilDone();
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        redirectEcomSessionRefresh();
        return;
      }
      setVidBusy(false);
      setVideoTaskStartedAt(null);
      dismissVideoPoll();
      await onAlert({
        title: "提交失败",
        message: e instanceof Error ? e.message : "视频任务提交失败",
        variant: "error",
      });
    }
  }

  async function handleGeneratePanelVideo(
    panelIndex: number,
    opts?: {
      /** 批量生成时由外层统一维护 busy 态 */
      deferBusy?: boolean;
      quietSuccess?: boolean;
      quietError?: boolean;
      /** 模型选择器刚确认的 modelKey（React state 尚未更新） */
      modelKeyOverride?: string;
      /** 批量并发时跳过逐镜 onProjectChange，由外层统一 reload */
      skipProjectUpdate?: boolean;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!project.sheet?.panels.find((p) => p.index === panelIndex)?.imageUrl) {
      const message = "请先生成该镜头分镜图。";
      if (!opts?.quietError) {
        await onAlert({ title: "提示", message });
      }
      return { ok: false, error: message };
    }
    const effectiveModel = opts?.modelKeyOverride?.trim() || videoModel;
    if (!opts?.deferBusy) {
      panelVideoWatchRef.current = [panelIndex];
      panelVideoInFlightRef.current = true;
      setPanelVidBusyPanels((prev) =>
        prev.includes(panelIndex) ? prev : [...prev, panelIndex],
      );
    }
    try {
      const { videoUrl } = await generateStoryboardPanelVideo(project.id, {
        panelIndex,
        aspectRatio,
        durationSec: panelDurationSec,
        resolution: videoResolution,
        modelKey: effectiveModel,
      });
      if (!opts?.skipProjectUpdate && project.sheet) {
        const panels = project.sheet.panels.map((p) =>
          p.index === panelIndex ? { ...p, videoUrl } : p,
        );
        onProjectChange({ ...project, sheet: { ...project.sheet, panels } });
      }
      if (!opts?.skipProjectUpdate) {
        onVideoReady();
      }
      if (!opts?.quietSuccess) {
        await onAlert({
          title: "镜头视频已生成",
          message: `镜头 ${panelIndex} 视频已保存，交付快照已更新。≥2 镜可点「合并分镜视频」。`,
        });
      }
      return { ok: true };
    } catch (e) {
      const raw = e instanceof Error ? e.message : "镜头视频生成失败";
      if (isStoryboardUpstreamTransportError(raw)) {
        try {
          const refreshed = await getStoryboardProject(project.id);
          if (
            storyboardPanelHasMedia(refreshed.sheet?.panels ?? [], panelIndex, "video")
          ) {
            if (!opts?.skipProjectUpdate) {
              onProjectChange(refreshed);
              onVideoReady();
            }
            if (!opts?.quietSuccess) {
              await onAlert({
                title: "镜头视频已生成",
                message: `镜头 ${panelIndex} 视频已保存，交付快照已更新。≥2 镜可点「合并分镜视频」。`,
              });
            }
            return { ok: true };
          }
        } catch {
          /* 仍按传输失败处理 */
        }
      }
      const message = formatStoryboardVideoGenError(raw);
      if (!opts?.quietError) {
        await onAlert({
          title: "生成失败",
          message,
          variant: "error",
        });
      }
      return { ok: false, error: message };
    } finally {
      if (!opts?.deferBusy) {
        panelVideoInFlightRef.current = false;
        panelVideoWatchRef.current = panelVideoWatchRef.current.filter(
          (i) => i !== panelIndex,
        );
        setPanelVidBusyPanels((prev) => prev.filter((i) => i !== panelIndex));
        await syncGeneratingPanelVideos();
      }
    }
  }

  async function handleGeneratePanelVideosBatch(
    panelIndexes: number[],
    modelKeyOverride?: string,
  ) {
    const queue = [...panelIndexes].sort((a, b) => a - b);
    if (queue.length === 0) return;
    const charMode =
      fashionResolvedCharModeRef.current ?? fashionCharacterMode(project);
    if (!(await ensureCharacterRefForMediaGen(charMode))) {
      return;
    }
    panelVideoWatchRef.current = queue;
    panelVideoInFlightRef.current = true;
    setPanelVidBusyPanels(queue);
    const failures: { index: number; message: string }[] = [];
    let latestPanels = project.sheet?.panels ?? [];
    try {
      await Promise.all(
        queue.map(async (panelIndex) => {
          const result = await handleGeneratePanelVideo(panelIndex, {
            deferBusy: true,
            quietSuccess: true,
            quietError: true,
            modelKeyOverride,
            skipProjectUpdate: true,
          });
          if (result.ok) {
            try {
              const refreshed = await getStoryboardProject(project.id);
              onProjectChange(refreshed);
              onVideoReady();
              latestPanels = refreshed.sheet?.panels ?? latestPanels;
            } catch {
              /* ignore transient reload errors */
            }
          }
          if (!result.ok) {
            failures.push({ index: panelIndex, message: result.error ?? "生成失败" });
          }
        }),
      );
      try {
        const refreshed = await getStoryboardProject(project.id);
        onProjectChange(refreshed);
        onVideoReady();
        latestPanels = refreshed.sheet?.panels ?? latestPanels;
      } catch {
        /* 单镜已成功时仍尽量保留本地 sheet 更新 */
      }
    } finally {
      panelVideoInFlightRef.current = false;
      panelVideoWatchRef.current = [];
      setPanelVidBusyPanels([]);
      await syncGeneratingPanelVideos();
    }
    const reconciledFailures = filterStoryboardBatchFailuresByPanelMedia(
      failures,
      latestPanels,
      "video",
    );
    reconciledFailures.sort((a, b) => a.index - b.index);
    if (reconciledFailures.length === 0) {
      await onAlert({
        title: "批量完成",
        message: `已生成 ${queue.length} 镜视频。≥2 镜可点「合并分镜视频」。`,
      });
      return;
    }
    if (reconciledFailures.length < queue.length) {
      await onAlert({
        title: "部分镜头失败",
        message: reconciledFailures.map((f) => `镜头 ${f.index}：${f.message}`).join("\n"),
        variant: "error",
      });
      return;
    }
    await onAlert({
      title: "生成失败",
      message: reconciledFailures[0]?.message ?? "镜头视频生成失败",
      variant: "error",
    });
  }

  async function handleSaveFashionSellpoints(sellpoints: FashionSellpoint[]) {
    const patch = buildFashionSellpointsSavePatch(project, sellpoints);
    if (!patch) return;
    setFashionSellpointsSaving(true);
    try {
      const updated = await updateStoryboardProject(project.id, {
        meta: {
          ...project.meta,
          deliverable: patch.deliverable,
          workflow: {
            ...(project.meta?.workflow ?? {}),
            ...patch.workflow,
          },
        },
      });
      onProjectChange(updated);
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "卖点保存失败，请稍后重试",
        variant: "error",
      });
    } finally {
      setFashionSellpointsSaving(false);
    }
  }

  async function handleSaveFashionPanels(panels: FashionPanelRow[]) {
    const patch = buildFashionStoryboardPanelsSavePatch(project, panels);
    if (!patch) return;
    setFashionPanelsSaving(true);
    try {
      const updated = await updateStoryboardProject(project.id, {
        meta: {
          ...project.meta,
          deliverable: patch.deliverable,
          workflow: {
            ...(project.meta?.workflow ?? {}),
            ...patch.workflow,
          },
        },
      });
      onProjectChange(updated);
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "分镜表保存失败，请稍后重试",
        variant: "error",
      });
    } finally {
      setFashionPanelsSaving(false);
    }
  }

  async function handleSaveDeliverableSnapshot() {
    setSnapshotBusy(true);
    try {
      const { project: updated } = await saveStoryboardDeliverableSnapshot(project.id);
      onProjectChange(updated);
      await onAlert({
        title: "快照已保存",
        message: "交付快照已更新，可点「交付查阅」预览全部图片与视频。",
      });
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "快照保存失败",
        variant: "error",
      });
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function handleMergePanelVideos(panelIndexes?: number[]) {
    setMergeBusy(true);
    try {
      try {
        const fresh = await getStoryboardProject(project.id);
        onProjectChange(fresh);
      } catch {
        /* 合并仍以服务端 getEcomStoryboardProject 为准；刷新失败不阻断 */
      }
      const profile = mergeBurnIn
        ? {
            subtitle: {
              mode: "script" as const,
              burnIn: true,
              style: mergeSubtitleStyle,
            },
          }
        : undefined;
      const submitted = await renderStoryboardPanelVideos(project.id, {
        profile,
        panelIndexes:
          panelIndexes && panelIndexes.length >= 2 ? panelIndexes : undefined,
      });
      const job = await waitStoryboardMediaRender(submitted.id);
      if (job.status !== "SUCCEEDED" || !job.downloadUrl) {
        throw new Error(job.errorMessage ?? "视频合并失败");
      }
      const expiresLabel = new Date(job.expiresAt).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      onProjectChange({
        ...project,
        videoOssUrl: job.downloadUrl,
        videoAssetId: null,
        meta: {
          ...project.meta,
          deliverableSnapshot: {
            ...(project.meta?.deliverableSnapshot ?? {
              savedAt: new Date().toISOString(),
              title: project.sheet!.overview.title,
              sheet: project.sheet!,
              references,
              panelVideos: project.sheet!.panels
                .filter((p) => Boolean(p.videoUrl?.trim()))
                .map((p) => ({ index: p.index, videoUrl: p.videoUrl!.trim() })),
            }),
            videoUrl: job.downloadUrl,
            renderJobId: job.id,
            renderExpiresAt: job.expiresAt,
            videoMode: "merged_panels",
          },
        },
      });
      onVideoReady();
      try {
        const fresh = await getStoryboardProject(project.id);
        onProjectChange(fresh);
      } catch {
        /* 本地状态已更新，刷新失败不阻断 */
      }
      await onAlert({
        title: "合并完成",
        message: `各镜头已云端合成（含转场）。成片请在 ${expiresLabel} 前下载，到期将自动清理；购买容量包可延期保留。`,
      });
    } catch (e) {
      await onAlert({
        title: "合并失败",
        message: e instanceof Error ? e.message : "视频合并失败",
        variant: "error",
      });
    } finally {
      setMergeBusy(false);
    }
  }

  const panelVideoCount =
    project.sheet?.panels.filter((p) => Boolean(p.videoUrl)).length ?? 0;
  const canMergePanels = panelVideoCount >= 2;

  const canShowGenerate =
    Boolean(project.sheet) ||
    schemes.length > 0 ||
    Boolean(project.meta?.deliverableMarkdown);
  const canGenerateImage = canShowGenerate;
  const canGenerateVideo = hasSheetImages;
  const deliverableSnapshot = project.meta?.deliverableSnapshot;
  const resolvedVideoUrl = (() => {
    const candidates = [
      videoOssUrl,
      project.videoOssUrl,
      deliverableSnapshot?.videoUrl,
    ];
    for (const u of candidates) {
      if (isStoryboardVideoUrl(u)) return u!.trim();
    }
    if (project.videoAssetId) {
      for (const u of candidates) {
        const t = typeof u === "string" ? u.trim() : "";
        if (t && /^https?:\/\//.test(t) && !isStoryboardImageUrl(t)) return t;
      }
    }
    return null;
  })();

  function formatTaskElapsed(startedAt: string | null) {
    if (!startedAt) return "";
    const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
  }

  const panelMediaStrip =
    project.sheet != null ? (
      <StoryboardPanelMediaStrip
        sheet={project.sheet}
        aspectRatio={aspectRatio}
        selectedImagePanels={panelImageStripSelected}
        onToggleImagePanelSelect={togglePanelImageStripSelect}
        selectedVideoPanels={panelVideoStripSelected}
        onToggleVideoPanelSelect={togglePanelVideoStripSelect}
        activeImageGenPanels={activeImageGenPanels}
        panelVidBusyPanels={[...activePanelVideoPanels]}
        imgBusy={imgBusy}
        vidBusy={vidBusy || activePanelVideoPanels.size > 0}
        mergeBusy={mergeBusy}
        onGenerateAllImages={(panelIndexes) => {
          if (
            isFashionProject(project) &&
            resolveFashionDeliverable(project)?.outputMode === "direct_video"
          ) {
            beginFashionImageGeneration(
              panelIndexes && panelIndexes.length > 0
                ? { batchIndexes: panelIndexes }
                : {},
            );
            return;
          }
          if (panelIndexes && panelIndexes.length > 0) {
            openImagePicker(undefined, panelIndexes);
            return;
          }
          openImagePicker();
        }}
        onGenerateSelectedVideos={(indexes) => openVideoPickerForPanelIndexes(indexes)}
        onMergeSelectedVideos={(indexes) => void handleMergePanelVideos(indexes)}
        onGeneratePanelImage={(panelIndex) => {
          if (
            isFashionProject(project) &&
            resolveFashionDeliverable(project)?.outputMode === "direct_video"
          ) {
            beginFashionImageGeneration({ panelIndex });
            return;
          }
          openImagePicker(panelIndex);
        }}
        onPreviewImage={openPanelImagePreview}
        onPreviewPanelPrompt={openPanelPromptPreview}
        onPreviewPanelVideo={(_panelIndex, videoUrl) =>
          onPreviewVideo(videoUrl, `镜头 ${_panelIndex}`)
        }
        onRegeneratePanelVideo={(panelIndex) => openVideoPicker({ panelIndex })}
        mergedVideoUrl={resolvedVideoUrl}
        mergedVideoExpiresAt={deliverableSnapshot?.renderExpiresAt ?? undefined}
        onPreviewMergedVideo={
          resolvedVideoUrl
            ? () => onPreviewVideo(resolvedVideoUrl, "合并成片")
            : undefined
        }
      />
    ) : null;

  const canExport =
    references.length > 0 ||
    Boolean(project.sheet?.panels?.length) ||
    Boolean(project.meta?.deliverableMarkdown?.trim()) ||
    Boolean(videoOssUrl?.trim()) ||
    Boolean(project.sheetPngUrl?.trim()) ||
    Boolean(project.sheet?.panels?.some((p) => p.imageUrl?.trim() || p.videoUrl?.trim()));

  async function handleSaveWorkflow(projectName: string) {
    setSaveWorkflowBusy(true);
    try {
      const snapshot = await saveStoryboardWorkflow(project.id, projectName);
      setSaveDialogOpen(false);
      await onAlert({
        title: "工作流已保存",
        message: `「${snapshot.title}」已保存到「我的资产 · 微剧故事版」，可一键复用。`,
      });
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSaveWorkflowBusy(false);
    }
  }

  const defaultSaveProjectName =
    resolveFashionDeliverable(project)?.productName?.trim() ||
    deliverable?.productName?.trim() ||
    project.title?.trim() ||
    "微剧故事版";
  const canSaveWorkflow =
    references.length > 0 ||
    Boolean(project.sheet?.panels?.length) ||
    Boolean(project.meta?.deliverableMarkdown?.trim()) ||
    (project.chatHistory?.length ?? 0) > 0 ||
    Boolean(resolveFashionDeliverable(project)?.sellpoints?.length) ||
    Boolean(resolveFashionDeliverable(project)?.storyboardVersions);

  async function handleExportZip() {
    setExportBusy(true);
    try {
      await downloadStoryboardExportZip(project.id);
    } catch (e) {
      await onAlert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setExportBusy(false);
    }
  }

  async function handleRetryFashionSheetSync() {
    if (!isFashionProject(project) || fashionSheetSyncing) return;
    setFashionSheetSyncing(true);
    try {
      const updated = await syncStoryboardSheet(project.id);
      onProjectChange(updated);
      if (!updated.sheet) {
        await onAlert({
          title: "故事版同步失败",
          message:
            "定稿分镜数据不完整。请回到中栏 12.1 分镜表确认已保存，再重新选择「故事版一键成片」。",
          variant: "error",
        });
      }
    } catch (e) {
      await onAlert({
        title: "故事版同步失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setFashionSheetSyncing(false);
    }
  }

  async function handleFashionClearPanelImages() {
    if (!project.sheet) return;
    const ok = await doubleConfirm({
      title: "清空分镜图",
      message: "确定清空故事版中所有分镜图？已生成的图片将被移除，脚本保留。",
      secondTitle: "不可恢复",
      secondMessage:
        "清空后各镜 imageUrl 将被移除；若图片已上传至云端存储（OSS），再次生成前需重新生图。",
      confirmLabel: "确认清空",
    });
    if (!ok) return;
    const panels = project.sheet.panels.map((p) => ({
      ...p,
      imageUrl: undefined,
      videoUrl: undefined,
    }));
    const updated = await updateStoryboardProject(project.id, {
      sheet: { ...project.sheet, panels },
      sheetPngUrl: null,
    });
    onProjectChange(updated);
  }

  async function handleFashionSubmitStoryboard() {
    if (!project.sheet || !hasAllPanelImages(project)) {
      await onAlert({ title: "提示", message: "请先生成全部 6 镜分镜图。" });
      return;
    }
    setFashionSubmitBusy(true);
    try {
      await compositeSheetPng(project.sheet, references);
      const { project: snapProject } = await saveStoryboardDeliverableSnapshot(project.id);
      const updated = await updateStoryboardProject(project.id, {
        meta: {
          ...snapProject.meta,
          workflow: {
            ...(snapProject.meta?.workflow ?? {}),
            vertical: "fashion_apparel",
            fashionPhase: "done",
            fashionProduceSetupPending: false,
          },
        },
      });
      onProjectChange(updated);
      await onAlert({
        title: "故事版已生成并提交",
        message: "完整分镜图与交付快照已保存，可在下方成片区合成视频。",
      });
    } catch (e) {
      await onAlert({
        title: "提交失败",
        message: e instanceof Error ? e.message : "故事版提交失败",
        variant: "error",
      });
    } finally {
      setFashionSubmitBusy(false);
    }
  }

  function openPanelPromptPreview(panelIndex: number) {
    const panel = project.sheet?.panels.find((p) => p.index === panelIndex);
    if (!panel) return;
    const fashionD = isFashionProject(project) ? resolveFashionDeliverable(project) : null;
    setPanelPromptPreview({
      title: `镜头 ${panel.index} · Prompt 预览`,
      prompt: formatPanelPromptPreview({
        panel,
        references,
        globalSceneAnchor: fashionD?.dimensions?.customScene?.trim(),
      }),
    });
  }

  async function runFashionCharacterGeneration(modelKeyOverride?: string) {
    if (!hasStoryboardProductRef(project)) {
      await onAlert({
        title: "缺少产品图",
        message: "生成角色参考图前须先上传产品图（必填）。",
        variant: "error",
      });
      return;
    }
    if (references.some((r) => r.role === "character")) {
      await onAlert({
        title: "已有角色图",
        message: "左侧素材区已存在角色参考图，可直接生成分镜图。",
      });
      return;
    }
    const modelKey = modelKeyOverride?.trim() || "";
    if (!modelKey) {
      openImagePicker(undefined, undefined, "character");
      return;
    }
    setFashionCharGenBusy(true);
    try {
      const { sheet: nextSheet, references: nextRefs } = await generateStoryboardSheetImage(
        project.id,
        {
          modelKey,
          aspectRatio,
          imageSize,
          autoGenCharacter: true,
          characterOnly: true,
        },
      );
      onProjectChange({
        ...project,
        sheet: nextSheet,
        references: nextRefs ?? project.references,
      });
      await onAlert({
        title: "角色参考图已生成",
        message: "已写入左侧素材区「自动生成角色」，可继续生成分镜图。",
      });
    } catch (e) {
      await onAlert({
        title: "角色图生成失败",
        message: e instanceof Error ? e.message : "AI 生成角色参考图失败",
        variant: "error",
      });
    } finally {
      setFashionCharGenBusy(false);
    }
  }

  async function handleFashionCharacterModeChange(mode: FashionCharacterRefMode) {
    fashionResolvedCharModeRef.current = mode;
    try {
      await persistFashionProduceWorkflow({
        fashionCharacterMode: mode,
        ...(mode === "ai" || references.some((r) => r.role === "character")
          ? { fashionProduceSetupPending: false }
          : {}),
      });
      if (mode === "upload") {
        onUploadRoleChange?.("character");
        return;
      }
      if (references.some((r) => r.role === "character")) {
        await onAlert({
          title: "已有角色图",
          message: "左侧素材区已存在角色参考图，可直接生成分镜图。",
        });
        return;
      }
      openImagePicker(undefined, undefined, "character");
    } catch (e) {
      await onAlert({
        title: "设置失败",
        message: e instanceof Error ? e.message : "无法保存角色参考方式",
        variant: "error",
      });
    }
  }

  function handleFashionGenerateSelected(indexes: number[]) {
    if (indexes.length === 0) return;
    beginFashionImageGeneration({ batchIndexes: indexes });
  }

  function handleFashionGenerateAll() {
    beginFashionImageGeneration({});
  }

  const fashionDeliverableResolved = resolveFashionDeliverable(project);
  const fashionDirectVideoProduce =
    isFashionProject(project) && fashionDeliverableResolved?.outputMode === "direct_video";
  const fashionProjectKeywords = buildFashionProjectKeywords(fashionDeliverableResolved);
  const fashionCharMode = fashionCharacterMode(project);
  const fashionHasCharRef = references.some((r) => r.role === "character");
  const fashionSetupReady = isFashionProduceSetupReady(project);
  const fashionAllPanelImages = hasAllPanelImages(project);

  useEffect(() => {
    if (!isFashionProject(project)) return;
    if (resolveFashionDeliverable(project)?.outputMode !== "direct_video") return;
    if (!fashionSheetNeedsScriptResync(project)) return;
    if (fashionSheetResyncRef.current || fashionSheetSyncing) return;
    fashionSheetResyncRef.current = true;
    void (async () => {
      try {
        const updated = await syncStoryboardSheet(project.id);
        onProjectChange(updated);
      } catch {
        fashionSheetResyncRef.current = false;
      }
    })();
  }, [project.id, project.sheet, project.meta, fashionSheetSyncing, onProjectChange]);

  const fashionProduceWorkspaceFallback =
    resolveFashionDeliverable(project)?.outputMode === "direct_video" && !project.sheet ? (
      <div className="space-y-3">
        <p className="text-sm text-[#86868b]">
          正在将定稿分镜同步为故事版整页版式…若长时间无内容，请点下方按钮重试。
        </p>
        <EcomButtonSecondary
          type="button"
          size="sm"
          disabled={fashionSheetSyncing}
          onClick={() => void handleRetryFashionSheetSync()}
        >
          {fashionSheetSyncing ? "同步中…" : "重新同步故事版"}
        </EcomButtonSecondary>
      </div>
    ) : undefined;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
        <header className="sticky top-0 z-30 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {project.title?.trim() || "微剧故事版"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">
                带货短视频分镜 · {durationSec}秒 · {aspectRatio}
                {project.sheet?.panels.length
                  ? ` · ${project.sheet.panels.length} 镜`
                  : ""}
                {" · 成图自动入库「我的资产 · 微剧故事版」"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onNewProject ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  dark
                  disabled={refBusy || Boolean(streaming)}
                  onClick={() => void onNewProject()}
                >
                  新建
                </EcomButtonSecondary>
              ) : null}
              {loadProjectList && onOpenProject ? (
                <EcomProjectListButton
                  disabled={refBusy || Boolean(streaming)}
                  currentProjectId={project.id}
                  loadProjects={loadProjectList}
                  onSelectProject={onOpenProject}
                  title="微剧故事版 · 项目列表"
                  emptyHint="还没有保存过的微剧故事版项目。"
                />
              ) : null}
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                onClick={() => router.push("/library")}
              >
                <Images className="h-3.5 w-3.5 shrink-0" />
                我的资产
              </EcomButtonSecondary>
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={!canSaveWorkflow || saveWorkflowBusy || Boolean(streaming)}
                onClick={() => setSaveDialogOpen(true)}
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                {saveWorkflowBusy ? "保存中…" : "保存工作流"}
              </EcomButtonSecondary>
              {onShareWorkflow ? (
                <EcomButtonSecondary size="sm" type="button" dark onClick={onShareWorkflow}>
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  分享工作流
                </EcomButtonSecondary>
              ) : null}
              {onOpenSettings ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  dark
                  onClick={() => onOpenSettings()}
                >
                  <Settings2 className="h-3.5 w-3.5 shrink-0" />
                  影片参数
                </EcomButtonSecondary>
              ) : null}
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={!canExport || exportBusy || Boolean(streaming)}
                onClick={() => void handleExportZip()}
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                {exportBusy ? "打包中…" : "导出交付包"}
              </EcomButtonSecondary>
            </div>
          </div>
        </header>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <StoryboardRefUploader
            references={references}
            onUpload={onRefUpload}
            onRemove={onRefRemove}
            onAttachAssets={(assetIds, role) => Promise.resolve(onAttachAssets(assetIds, role))}
            busy={refBusy}
            activeRole={uploadRole}
            onActiveRoleChange={onUploadRoleChange}
          />
        </section>

      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={vidBusy}
        title="整图成片生成中"
        surface="content"
        detail={`Gateway 视频任务进行中，通常需 3–8 分钟。${videoTaskStartedAt ? `已等待 ${formatTaskElapsed(videoTaskStartedAt)}` : ""}${videoPollCount > 0 ? ` · 轮询 ${videoPollCount} 次` : ""}。请勿重复提交。`}
      />
      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={Boolean(imgBusy || activeImageGenPanels.size > 0)}
        surface="content"
        title={
          imgBusy
            ? "分镜图生成中"
            : activeImageGenPanels.size > 0
              ? `镜头 ${[...activeImageGenPanels].sort((a, b) => a - b).join("、")} 分镜图生成中`
              : "分镜图生成中"
        }
        detail="图像任务进行中，可关闭弹层，进度显示于此与对应卡片；其它镜头可并行提交。"
      />
      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={!fashionDirectVideoProduce && activePanelVideoPanels.size > 0}
        surface="content"
        title={
          activePanelVideoPanels.size === 1
            ? `镜头 ${[...activePanelVideoPanels][0]} 单镜视频生成中`
            : `镜头 ${[...activePanelVideoPanels].sort((a, b) => a - b).join("、")} 单镜视频生成中`
        }
        detail="Gateway 视频任务进行中，通常每镜 3–8 分钟。进度显示于下方「单镜视频」区；可关闭模型弹层。"
      />
      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={!fashionDirectVideoProduce && mergeBusy}
        surface="content"
        title="合并分镜视频中"
        detail="云端合成各镜头视频（含转场），通常需 1–5 分钟…"
      />

      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6">
        {streaming ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-[#0071e3]/10 px-4 py-3 text-sm text-[#0071e3]">
            <Loader2 className="h-4 w-4 animate-spin" />
            助手正在流式输出，完成后将同步显示结构化结果…
          </div>
        ) : null}

        {isFashionProject(project) ? (
          <FashionStepResults
            project={project}
            sellpointsSaving={fashionSellpointsSaving}
            onSaveSellpoints={handleSaveFashionSellpoints}
            panelsSaving={fashionPanelsSaving}
            onSavePanels={handleSaveFashionPanels}
            produceWorkspace={
              resolveFashionDeliverable(project)?.outputMode === "direct_video" &&
              project.sheet ? (
                <FashionStoryboardSheetWorkspace
                  sheet={project.sheet}
                  references={references}
                  productName={fashionDeliverableResolved?.productName}
                  productHighlight={project.sheet.overview.productHighlight}
                  projectKeywords={fashionProjectKeywords}
                  activeImageGenPanels={activeImageGenPanels}
                  imgBusy={imgBusy}
                  submitBusy={fashionSubmitBusy}
                  charGenBusy={fashionCharGenBusy}
                  characterMode={fashionCharMode}
                  hasCharacterRef={fashionHasCharRef}
                  setupReady={fashionSetupReady}
                  allPanelsHaveImages={fashionAllPanelImages}
                  onCharacterModeChange={(mode) => void handleFashionCharacterModeChange(mode)}
                  onGeneratePanel={(panelIndex) =>
                    beginFashionImageGeneration({ panelIndex })
                  }
                  onGenerateSelected={handleFashionGenerateSelected}
                  onGenerateAll={handleFashionGenerateAll}
                  onClearPanelImages={() => void handleFashionClearPanelImages()}
                  onSubmitStoryboard={() => void handleFashionSubmitStoryboard()}
                  onResyncSheet={() => void handleRetryFashionSheetSync()}
                  resyncBusy={fashionSheetSyncing}
                  onOpenSheetPreview={() => setSheetPreviewOpen(true)}
                  onPreviewImage={openPanelImagePreview}
                  onPreviewPanelPrompt={openPanelPromptPreview}
                />
              ) : (
                fashionProduceWorkspaceFallback
              )
            }
            imagesSlot={
              project.sheet &&
              resolveFashionDeliverable(project)?.outputMode === "script_compose"
                ? panelMediaStrip
                : undefined
            }
            videoSlot={
              fashionDirectVideoProduce && project.sheet ? (
                <StoryboardDeliverableSection
                  durationSec={durationSec}
                  panelVideoCount={panelVideoCount}
                  videoAspectRatio={videoAspectRatio}
                  panelAspectRatio={aspectRatio}
                  sheetPngUrl={project.sheetPngUrl}
                  sheet={project.sheet}
                  references={references}
                  productName={deliverable?.productName}
                  productHighlight={project.sheet?.overview.productHighlight}
                  projectKeywords={pickProjectKeywords()}
                  videoUrl={resolvedVideoUrl}
                  hasSheetImages={hasSheetImages}
                  canMergePanels={false}
                  fullSheetOnly
                  vidBusy={vidBusy}
                  imageGenBusy={imgBusy}
                  sheetPngBusy={sheetPngBusy}
                  mergeBusy={mergeBusy}
                  mergeBurnIn={mergeBurnIn}
                  mergeSubtitleStyle={mergeSubtitleStyle}
                  onMergeBurnInChange={setMergeBurnIn}
                  onMergeSubtitleStyleChange={setMergeSubtitleStyle}
                  snapshotBusy={snapshotBusy}
                  hasDeliverableSnapshot={Boolean(deliverableSnapshot)}
                  onGenerateFullVideo={() => openVideoPicker({ fullSheet: true })}
                  onOpenDeliverableReview={() => setDeliverableReviewOpen(true)}
                  onSaveSnapshot={() => void handleSaveDeliverableSnapshot()}
                  onOpenImagePicker={() => openImagePicker()}
                  onOpenSheetPreview={() => setSheetPreviewOpen(true)}
                  onReloadProject={handleReloadProject}
                  onMergePanelVideos={() => void handleMergePanelVideos()}
                  onPreviewVideo={onPreviewVideo}
                />
              ) : undefined
            }
          />
        ) : (
        <StoryboardStepResults
          project={project}
          references={references}
          onPreviewImage={openPanelImagePreview}
          onEditScriptPanel={
            project.sheet ? (panelIndex) => setEditPanelIndex(panelIndex) : undefined
          }
          imagesSlot={panelMediaStrip}
          videoSlot={
            canShowGenerate ? (
              <StoryboardDeliverableSection
                durationSec={durationSec}
                panelVideoCount={panelVideoCount}
                videoAspectRatio={videoAspectRatio}
                panelAspectRatio={aspectRatio}
                sheetPngUrl={project.sheetPngUrl}
                sheet={project.sheet}
                references={references}
                productName={deliverable?.productName}
                productHighlight={
                  project.sheet?.overview.productHighlight ??
                  (typeof deliverable?.params?.卖点 === "string"
                    ? deliverable.params.卖点
                    : typeof deliverable?.params?.["核心卖点"] === "string"
                      ? deliverable.params["核心卖点"]
                      : undefined)
                }
                projectKeywords={pickProjectKeywords()}
                videoUrl={resolvedVideoUrl}
                hasSheetImages={hasSheetImages}
                canMergePanels={canMergePanels}
                vidBusy={vidBusy}
                imageGenBusy={imgBusy}
                sheetPngBusy={sheetPngBusy}
                mergeBusy={mergeBusy}
                mergeBurnIn={mergeBurnIn}
                mergeSubtitleStyle={mergeSubtitleStyle}
                onMergeBurnInChange={setMergeBurnIn}
                onMergeSubtitleStyleChange={setMergeSubtitleStyle}
                snapshotBusy={snapshotBusy}
                hasDeliverableSnapshot={Boolean(deliverableSnapshot)}
                onGenerateFullVideo={() => openVideoPicker({ fullSheet: true })}
                onOpenDeliverableReview={() => setDeliverableReviewOpen(true)}
                onSaveSnapshot={() => void handleSaveDeliverableSnapshot()}
                onOpenImagePicker={() => openImagePicker()}
                onOpenSheetPreview={() => setSheetPreviewOpen(true)}
                onReloadProject={handleReloadProject}
                onMergePanelVideos={() => void handleMergePanelVideos()}
                onPreviewVideo={onPreviewVideo}
              />
            ) : undefined
          }
        />
        )}
      </div>
      </div>

      <StoryboardModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={pickerMode}
        models={pickerMode === "image" ? imageModels : videoModels}
        value={pickerMode === "image" ? imageModel : videoModel}
        panelIndex={pendingPanelIndex}
        videoTarget={pendingVideoTarget}
        aspectRatio={pickerMode === "video" ? videoAspectRatio : aspectRatio}
        onAspectRatioChange={(v) => {
          if (pickerMode === "video") onVideoAspectChange?.(v);
          else if (v !== "1:1") onAspectChange(v);
        }}
        imageSize={imageSize}
        onImageSizeChange={onImageSizeChange}
        durationSec={durationSec}
        onDurationChange={onDurationChange}
        videoResolution={videoResolution}
        onVideoResolutionChange={onVideoResolutionChange}
        panelDurationSec={panelDurationSec}
        onPanelDurationChange={setPanelDurationSec}
        videoR2vRatio={videoR2vRatio}
        onVideoR2vRatioChange={(v) => {
          onVideoR2vRatioChange?.(v);
          const ar = aspectRatioFromR2vRatio(v);
          if (ar) onAspectChange(ar);
        }}
        videoSeed={videoSeed}
        onVideoSeedChange={onVideoSeedChange}
        videoPromptExtend={videoPromptExtend}
        onVideoPromptExtendChange={onVideoPromptExtendChange}
        onChange={(key) => {
          if (pickerMode === "image") onImageModelChange?.(key);
          else onVideoModelChange?.(key);
        }}
        confirming={
          pickerMode === "image"
            ? imgBusy ||
              (pendingPanelIndex != null && activeImageGenPanels.has(pendingPanelIndex))
            : pendingVideoTarget === "fullSheet"
              ? vidBusy
              : pendingPanelIndex != null && panelVidBusyPanels.includes(pendingPanelIndex)
        }
        onConfirm={(modelKey) => {
          const panelIdx = pendingPanelIndex;
          const mode = pickerMode;
          const batch = pendingBatchPanelsRef.current;
          const batchVideo = pendingBatchVideoPanelsRef.current;
          pendingBatchPanelsRef.current = null;
          pendingBatchVideoPanelsRef.current = null;
          const intent = fashionImagePickerIntentRef.current;
          fashionImagePickerIntentRef.current = "generate";
          if (mode === "image") onImageModelChange?.(modelKey);
          else onVideoModelChange?.(modelKey);
          setPickerOpen(false);
          setPendingPanelIndex(null);
          void (async () => {
            if (
              mode === "image" &&
              isFashionProject(project) &&
              resolveFashionDeliverable(project)?.outputMode === "direct_video"
            ) {
              await persistFashionProduceWorkflow({
                fashionImageModelKey: modelKey,
                ...(fashionCharacterMode(project)
                  ? { fashionProduceSetupPending: false }
                  : {}),
              });
            }
            if (mode === "image" && intent === "character") {
              await runFashionCharacterGeneration(modelKey);
              return;
            }
            if (mode === "image") {
              const fashionCharMode =
                fashionResolvedCharModeRef.current ?? fashionCharacterMode(project);
              if (batch && batch.length > 0) {
                await handleGenerateImagesBatch(batch, modelKey, fashionCharMode ?? undefined);
              } else {
                await handleGenerateImage(
                  panelIdx ?? undefined,
                  modelKey,
                  fashionCharMode ?? undefined,
                );
              }
            } else if (batchVideo && batchVideo.length > 0) {
              await handleGeneratePanelVideosBatch(batchVideo, modelKey);
            } else if (panelIdx != null) {
              await handleGeneratePanelVideo(panelIdx, { modelKeyOverride: modelKey });
            } else {
              await handleGenerateFullVideo(modelKey);
            }
          })();
        }}
      />

      <FashionCharacterRefChoiceDialog
        open={fashionCharChoiceOpen}
        onOpenChange={(open) => {
          if (!open) closeFashionCharChoiceDialog();
        }}
        onChoose={(choice) => void handleFashionCharChoice(choice)}
      />

      {deliverableSnapshot ? (
        <StoryboardDeliverableReviewDialog
          open={deliverableReviewOpen}
          onOpenChange={setDeliverableReviewOpen}
          snapshot={deliverableSnapshot}
          onPreviewVideo={onPreviewVideo}
        />
      ) : null}

      {project.sheet ? (
        <StoryboardSheetPreviewDialog
          open={sheetPreviewOpen}
          onOpenChange={setSheetPreviewOpen}
          sheet={project.sheet}
          references={references}
          productName={deliverable?.productName}
          productHighlight={
            project.sheet.overview.productHighlight ??
            (typeof deliverable?.params?.卖点 === "string"
              ? deliverable.params.卖点
              : undefined)
          }
          projectKeywords={
            isFashionProject(project) &&
            resolveFashionDeliverable(project)?.outputMode === "direct_video"
              ? buildFashionProjectKeywords(resolveFashionDeliverable(project))
              : pickProjectKeywords()
          }
          sheetHeading={
            isFashionProject(project) ? "服装专业版分镜故事版" : undefined
          }
        />
      ) : null}

      <EcomImagePreviewHost
        preview={imagePreview}
        galleryItems={panelImagePreviewItems}
        onClose={closeImagePreview}
      />

      <Dialog
        open={Boolean(panelPromptPreview)}
        onOpenChange={(open) => {
          if (!open) setPanelPromptPreview(null);
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(94vw,56rem)] max-w-none flex-col gap-4 p-6 sm:max-w-none">
          <DialogHeader className="shrink-0">
            <DialogTitle>{panelPromptPreview?.title ?? "生图 Prompt"}</DialogTitle>
          </DialogHeader>
          <div
            className="ecom-scrollbar-thin min-h-[min(58vh,560px)] max-h-[min(72vh,680px)] w-full flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#f5f5f7] px-4 py-3 text-[13px] leading-relaxed text-[#1d1d1f]"
          >
            {panelPromptPreview?.prompt ?? ""}
          </div>
        </DialogContent>
      </Dialog>

      <StoryboardPanelEditDialog
        open={editPanelIndex != null}
        onOpenChange={(open) => {
          if (!open) setEditPanelIndex(null);
        }}
        panel={
          editPanelIndex != null && project.sheet
            ? project.sheet.panels.find((p) => p.index === editPanelIndex) ?? null
            : null
        }
        onSave={handlePanelSave}
        saving={savingPanel}
      />

      <StoryboardSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultProjectName={defaultSaveProjectName}
        busy={saveWorkflowBusy}
        onConfirm={handleSaveWorkflow}
      />
    </div>
  );
}
