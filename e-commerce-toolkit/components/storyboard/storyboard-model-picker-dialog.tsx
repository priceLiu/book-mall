"use client";

/**
 * 电商工具箱 · 生图/生视频模型选择弹层（唯一实现，见 `.cursor/rules/ecom-model-picker.mdc`）
 * 横向长条卡片 + 左侧列表/右侧参数 + 类型筛选。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Cpu, Image as ImageIcon, Loader2, Video } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EcomDialogCloseButton,
} from "@/components/ui/dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  STORYBOARD_VIDEO_RESOLUTION_OPTIONS,
  type StoryboardVideoResolution,
} from "@/lib/storyboard-gen-params";
import {
  imagePickerUsesAspectRatioOnly,
  imageSizeOptionsForModel,
  defaultImageSizeForModel,
  aspectRatioForImageSize,
  filterImageSizeOptionsByEcomRatio,
  isStoryboardKlingImageModel,
} from "@/lib/storyboard-image-size-options";
import {
  STORYBOARD_R2V_RATIO_OPTIONS,
  isStoryboardBailianR2vModel,
  isStoryboardKling30KieVideoModel,
  isStoryboardWan30VideoModel,
  isStoryboardWan27BailianR2vModel,
  isStoryboardWanR2vModel,
  resolveStoryboardVideoFullSheetDurationRange,
  resolveStoryboardVideoPanelDurationRange,
  storyboardFullSheetDurationMismatchMessage,
  storyboardPanelDurationMismatchMessage,
  videoModelSupportsGenerateAudio,
  videoGenerateAudioControlLabel,
  videoResolutionOptionsForModel,
  type StoryboardVideoAspectRatio,
  type StoryboardVideoDurationRange,
} from "@/lib/storyboard-video-params";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import {
  formatStoryboardImageModelTypeLabel,
  storyboardModelFilterTabsForMode,
  storyboardModelMatchesMediaFilter,
  type StoryboardModelMediaFilter,
} from "@/lib/storyboard-model-type-filter";
import { formatStoryboardVideoModelTypeLabel } from "@/lib/storyboard-video-model-type";
import { formatStoryboardModelRefCountLabel } from "@/lib/storyboard-model-ref-count";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

/** 弹层默认尺寸（可被 `contentClassName` 覆盖） */
export const STORYBOARD_MODEL_PICKER_DIALOG_CLASS =
  "flex max-h-[min(80vh,640px)] w-[min(96vw,920px)] max-w-[920px] flex-col gap-0 overflow-hidden p-0";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "image" | "video";
  models: StoryboardGatewayModel[];
  value: string;
  onChange: (key: string) => void;
  onConfirm: (modelKey: string) => void;
  confirming?: boolean;
  panelIndex?: number | null;
  videoTarget?: "panel" | "fullSheet";
  aspectRatio?: StoryboardVideoAspectRatio;
  onAspectRatioChange?: (v: StoryboardVideoAspectRatio) => void;
  imageSize?: string;
  onImageSizeChange?: (v: string) => void;
  /** 尺寸由平台规则决定时（电商产品创作），以只读行替代尺寸下拉 */
  lockedImageSizeLabel?: string;
  /** 只读参数行标题，默认「输出比例」 */
  lockedFieldLabel?: string;
  /** 覆盖弹层标题（如视觉分析模型） */
  dialogTitle?: string;
  /** 覆盖弹层副标题 */
  dialogDescription?: string;
  /** 覆盖确认按钮文案 */
  confirmLabel?: string;
  /** 覆盖底部左侧提示 */
  footerHint?: string;
  /** 模型列表加载中（弹层已开但清单尚未返回） */
  modelsLoading?: boolean;
  /** 无模型时的补充说明 */
  modelsEmptyHint?: string;
  /** 无模型时点击重试 */
  onRetryLoadModels?: () => void | Promise<void>;
  /** 隐藏文生图/图生视频类型筛选（视觉理解 LLM 等纯选型场景） */
  hideTypeFilter?: boolean;
  /**
   * 使用 createPortal + 自定义 overlay，不经 Radix Dialog。
   * 素材区粘贴热区与 Radix 焦点陷阱冲突时启用（如服装模特图）。
   */
  nativeOverlay?: boolean;
  /** 模型已确认、任务进行中：弹层内展示进度态 */
  running?: boolean;
  runningTitle?: string;
  runningDetail?: string;
  durationSec?: number;
  onDurationChange?: (v: number) => void;
  videoResolution?: StoryboardVideoResolution;
  onVideoResolutionChange?: (v: StoryboardVideoResolution) => void;
  panelDurationSec?: number;
  onPanelDurationChange?: (v: number) => void;
  videoR2vRatio?: string;
  onVideoR2vRatioChange?: (v: string) => void;
  videoSeed?: string;
  onVideoSeedChange?: (v: string) => void;
  videoPromptExtend?: boolean;
  onVideoPromptExtendChange?: (v: boolean) => void;
  videoGenerateAudio?: boolean;
  onVideoGenerateAudioChange?: (v: boolean) => void;
  /** 单镜成片且待生成镜头含口播文案 */
  panelHasVoiceover?: boolean;
};

/** providerKind → 中文分组名（弹层标题用） */
const PROVIDER_LABELS: Record<string, string> = {
  DASHSCOPE: "通义万相",
  BAILIAN: "百炼",
  KIE: "KIE",
  VOLCENGINE: "火山方舟",
  HUNYUAN: "混元 3D",
  DEEPSEEK: "DeepSeek",
};

function providerLabel(kind: string): string {
  return PROVIDER_LABELS[kind] ?? kind;
}

function pickerTitle(
  mode: "image" | "video",
  panelIndex?: number | null,
  videoTarget?: "panel" | "fullSheet",
) {
  if (mode === "image") {
    return typeof panelIndex === "number" ? `镜头 ${panelIndex} · 重新生图` : "生成全部分镜图";
  }
  if (typeof panelIndex === "number") return `镜头 ${panelIndex} · 生成视频`;
  if (videoTarget === "fullSheet") return "整图成片 · 生成视频";
  return "选择视频模型";
}

/** 该模型在当前模式下可调参数数量（用于卡片角标） */
function countAdjustableParams(
  mode: "image" | "video",
  modelKey: string,
  videoTarget: "panel" | "fullSheet",
  lockedRatio?: boolean,
): number {
  if (mode === "image") {
    if (lockedRatio) return 1;
    return imagePickerUsesAspectRatioOnly(modelKey) ? 1 : 2;
  }
  let n = 2; // 视频分辨率 + 时长
  const isBailianR2v = isStoryboardBailianR2vModel(modelKey);
  if (isStoryboardWan30VideoModel(modelKey)) {
    n += 1; // 画面比例
    return n;
  }
  if (isBailianR2v) {
    n += 2; // 画布比例 + 随机种子
    if (isStoryboardWanR2vModel(modelKey)) n += 1; // 智能扩写
  } else {
    n += 1; // 画面比例
  }
  if (videoModelSupportsGenerateAudio(modelKey)) n += 1;
  // panel / fullSheet 都各有一个时长控件，已计入
  void videoTarget;
  return n;
}

function roleBadgeTone(role: string): string {
  switch (role) {
    case "IMAGE":
      return "bg-[#fff4e5] text-[#b25e09]";
    case "VIDEO":
      return "bg-[#e8f1ff] text-[#0058c7]";
    default:
      return "bg-[#eef0f2] text-[#6e6e73]";
  }
}

function modelVideoDurationLabel(
  mode: "image" | "video",
  modelKey: string,
  videoTarget: "panel" | "fullSheet",
): string | null {
  if (mode !== "video") return null;
  const range =
    videoTarget === "panel"
      ? resolveStoryboardVideoPanelDurationRange(modelKey)
      : resolveStoryboardVideoFullSheetDurationRange(modelKey);
  return `时长 ${range.label}`;
}

function ModelCard({
  model,
  selected,
  paramCount,
  durationLabel,
  mode,
  onSelect,
}: {
  model: StoryboardGatewayModel;
  selected: boolean;
  paramCount: number;
  durationLabel?: string | null;
  mode: "image" | "video";
  onSelect: () => void;
}) {
  const disabled = !model.credentialBound && !model.platformOffering;
  const typeLabel =
    mode === "video"
      ? formatStoryboardVideoModelTypeLabel(model.modelKey)
      : formatStoryboardImageModelTypeLabel(model.modelKey, model.role);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full min-h-[4.75rem] flex-row items-stretch gap-4 rounded-xl border px-4 py-3 text-left transition",
        selected
          ? "border-[var(--ecom-primary)] bg-[#f0f6ff] shadow-sm"
          : "border-[#e8e8ed] bg-white hover:border-[#c7c7cc] hover:bg-[#fafafa]",
        disabled && "cursor-not-allowed opacity-50 hover:border-[#e8e8ed] hover:bg-white",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold text-[#1d1d1f]">
            {model.displayName || model.modelKey}
          </p>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              roleBadgeTone(model.role),
            )}
            title={typeLabel}
          >
            {typeLabel}
          </span>
          {model.sourceLabel ? (
            <span className="shrink-0 rounded bg-[#eef0f2] px-1.5 py-0.5 text-[10px] text-[#6e6e73]">
              {model.sourceLabel}
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-[11px] text-[#86868b]">{model.modelKey}</p>
        {model.description ? (
          <p className="line-clamp-1 text-[11px] leading-relaxed text-[#6e6e73]">
            {model.description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-1 text-right">
        <span className="text-[10px] text-[#a1a1a6]">
          {formatStoryboardModelRefCountLabel(model.modelKey, mode)}
          {" · "}
          {durationLabel ? `${durationLabel} · ` : ""}
          {paramCount > 0 ? `${paramCount} 项可调参数` : "无可调参数"}
        </span>
        {disabled ? <span className="text-[10px] text-[#c0392b]">未绑定</span> : null}
      </div>
      {selected ? (
        <span className="absolute right-3 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-full bg-[var(--ecom-primary)] text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </button>
  );
}

function ModelMediaFilterBar({
  mode,
  models,
  value,
  onChange,
}: {
  mode: "image" | "video";
  models: StoryboardGatewayModel[];
  value: StoryboardModelMediaFilter;
  onChange: (next: StoryboardModelMediaFilter) => void;
}) {
  const tabs = storyboardModelFilterTabsForMode(mode);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#f0f0f2] pb-3">
      <span className="text-[11px] font-medium text-[#86868b]">类型</span>
      {tabs.map((tab) => {
        const count = models.filter((m) =>
          storyboardModelMatchesMediaFilter(m, mode, tab.id),
        ).length;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.id !== "all" && count === 0}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-medium transition",
              active
                ? "border-[var(--ecom-primary)] bg-[#f0f6ff] text-[var(--ecom-primary)]"
                : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[#c7c7cc] hover:bg-[#fafafa]",
              tab.id !== "all" && count === 0 && "cursor-not-allowed opacity-40 hover:bg-white",
            )}
          >
            {tab.label}
            {tab.id !== "all" && count > 0 ? (
              <span className="ml-1 tabular-nums text-[11px] opacity-80">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** 点击刷新/视频后弹出：卡片选模型 + 下方动态参数 */
export function StoryboardModelPickerDialog({
  open,
  onOpenChange,
  mode,
  models,
  value,
  onChange,
  onConfirm,
  confirming,
  panelIndex,
  videoTarget = "fullSheet",
  aspectRatio = "9:16",
  onAspectRatioChange,
  imageSize = "720*1280",
  onImageSizeChange,
  lockedImageSizeLabel,
  lockedFieldLabel = "输出比例",
  dialogTitle,
  dialogDescription,
  confirmLabel,
  footerHint,
  modelsLoading = false,
  modelsEmptyHint,
  onRetryLoadModels,
  hideTypeFilter = false,
  contentClassName,
  nativeOverlay = false,
  running = false,
  runningTitle,
  runningDetail,
  durationSec = 10,
  onDurationChange,
  videoResolution = "1080p",
  onVideoResolutionChange,
  panelDurationSec = 3,
  onPanelDurationChange,
  videoR2vRatio = "9:16",
  onVideoR2vRatioChange,
  videoSeed = "",
  onVideoSeedChange,
  videoPromptExtend = true,
  onVideoPromptExtendChange,
  videoGenerateAudio = true,
  onVideoGenerateAudioChange,
  panelHasVoiceover = false,
}: Props) {
  const action = confirmLabel ?? (mode === "image" ? "开始生图" : "开始生成");
  const subtitle =
    dialogDescription ??
    (mode === "image" ? "选择生图模型并调整尺寸，用于生成分镜图。" : "");
  const footerLeftHint =
    footerHint ??
    (confirming || running
      ? "任务进行中，请稍候…"
      : "选好模型与参数后开始生成。");
  const showImageSize = mode === "image";
  const showFullDuration = mode === "video" && videoTarget === "fullSheet";
  const showPanelDuration = mode === "video" && videoTarget === "panel";
  const showResolution = mode === "video";

  const [draftKey, setDraftKey] = useState(value);
  const [mediaFilter, setMediaFilter] = useState<StoryboardModelMediaFilter>("all");
  const [confirmBlockMessage, setConfirmBlockMessage] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const suppressBackdropCloseUntilRef = useRef(0);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftKey(value);
      setMediaFilter("all");
      setConfirmBlockMessage(null);
      if (nativeOverlay) {
        suppressBackdropCloseUntilRef.current = Date.now() + 450;
      }
    }
    wasOpenRef.current = open;
  }, [open, value, nativeOverlay]);

  const visibleModels = useMemo(
    () =>
      hideTypeFilter
        ? models
        : models.filter((m) => storyboardModelMatchesMediaFilter(m, mode, mediaFilter)),
    [hideTypeFilter, models, mode, mediaFilter],
  );

  useEffect(() => {
    if (!open || visibleModels.length === 0) return;
    setDraftKey((current) => {
      if (visibleModels.some((m) => m.modelKey === current)) return current;
      return pickBoundStoryboardModelKey(visibleModels, value || visibleModels[0]!.modelKey);
    });
  }, [open, visibleModels, value]);

  const selectedModel = models.find((m) => m.modelKey === draftKey) ?? null;
  const isBailianR2v = mode === "video" && isStoryboardBailianR2vModel(draftKey);
  const isKling30 = mode === "video" && isStoryboardKling30KieVideoModel(draftKey);
  const lockedRatioHint = lockedImageSizeLabel?.split("（")[0]?.trim();
  const hasLockedRatio = Boolean(lockedRatioHint);
  const klingImageAspectOnly =
    mode === "image" && imagePickerUsesAspectRatioOnly(draftKey, { lockedRatio: hasLockedRatio });
  const currentImageSizeOptions = useMemo(
    () =>
      filterImageSizeOptionsByEcomRatio(
        imageSizeOptionsForModel(draftKey, { lockedRatio: hasLockedRatio }),
        lockedRatioHint,
      ),
    [draftKey, lockedRatioHint, hasLockedRatio],
  );
  const currentVideoResolutionOptions = useMemo(
    () => videoResolutionOptionsForModel(draftKey),
    [draftKey],
  );
  const showGenerateAudio =
    mode === "video" && videoModelSupportsGenerateAudio(draftKey);
  const generateAudioLabel = videoGenerateAudioControlLabel(draftKey);
  const showPanelVoiceoverAudio =
    mode === "video" && videoTarget === "panel" && panelHasVoiceover;
  useEffect(() => {
    if (mode !== "image" || !onImageSizeChange) return;
    if (klingImageAspectOnly) return;
    const opts = currentImageSizeOptions;
    if (!opts.some((o) => o.value === imageSize)) {
      onImageSizeChange(
        defaultImageSizeForModel(
          draftKey,
          (lockedRatioHint === "16:9" ||
          lockedRatioHint === "9:16" ||
          lockedRatioHint === "3:4" ||
          lockedRatioHint === "4:5" ||
          lockedRatioHint === "1:1"
            ? lockedRatioHint
            : aspectRatio === "16:9"
              ? "16:9"
              : "9:16") as "16:9" | "9:16" | "3:4" | "4:5" | "1:1",
          { lockedRatio: hasLockedRatio },
        ),
      );
    }
  }, [
    mode,
    draftKey,
    currentImageSizeOptions,
    imageSize,
    onImageSizeChange,
    klingImageAspectOnly,
    aspectRatio,
    lockedRatioHint,
    hasLockedRatio,
  ]);

  useEffect(() => {
    if (mode !== "video" || !onVideoResolutionChange) return;
    if (!currentVideoResolutionOptions.some((o) => o.value === videoResolution)) {
      onVideoResolutionChange(
        (currentVideoResolutionOptions[0]?.value ?? "1080p") as StoryboardVideoResolution,
      );
    }
  }, [mode, draftKey, currentVideoResolutionOptions, videoResolution, onVideoResolutionChange]);

  const showAspect = mode === "video" && !isBailianR2v;
  const showR2vRatio = mode === "video" && isBailianR2v;
  const showWanR2vExtras = mode === "video" && isStoryboardWanR2vModel(draftKey);
  const showR2vSeed = mode === "video" && isBailianR2v;
  const fullDurationRange: StoryboardVideoDurationRange =
    resolveStoryboardVideoFullSheetDurationRange(draftKey);
  const panelDurationRange: StoryboardVideoDurationRange =
    resolveStoryboardVideoPanelDurationRange(draftKey);
  const fullDurationMin = fullDurationRange.min;
  const fullDurationMax = fullDurationRange.max;
  const panelDurationMin = panelDurationRange.min;
  const panelDurationMax = panelDurationRange.max;

  const longDurationHintMessage = useMemo(() => {
    if (mode !== "video") return null;
    if (
      showFullDuration &&
      durationSec > 15 &&
      !isStoryboardWan30VideoModel(draftKey) &&
      !isStoryboardWan27BailianR2vModel(draftKey)
    ) {
      return `成片 ${durationSec}s 超过 15s，建议选择「万相 3.0」或「万相 2.7 R2V」。`;
    }
    if (
      showPanelDuration &&
      panelDurationSec != null &&
      panelDurationSec > 15 &&
      !isStoryboardWan30VideoModel(draftKey)
    ) {
      return `单镜 ${panelDurationSec}s 超过 15s，建议选择「万相 3.0」。`;
    }
    return null;
  }, [mode, showFullDuration, showPanelDuration, durationSec, panelDurationSec, draftKey]);

  useEffect(() => {
    if (mode !== "video") return;
    if (showFullDuration && onDurationChange) {
      const clamped = Math.min(fullDurationMax, Math.max(fullDurationMin, durationSec));
      if (clamped !== durationSec) onDurationChange(clamped);
    }
    if (showPanelDuration && onPanelDurationChange && panelDurationSec != null) {
      const clamped = Math.min(panelDurationMax, Math.max(panelDurationMin, panelDurationSec));
      if (clamped !== panelDurationSec) onPanelDurationChange(clamped);
    }
  }, [
    mode,
    draftKey,
    durationSec,
    panelDurationSec,
    fullDurationMin,
    fullDurationMax,
    panelDurationMin,
    panelDurationMax,
    showFullDuration,
    showPanelDuration,
    onDurationChange,
    onPanelDurationChange,
  ]);

  useEffect(() => {
    setConfirmBlockMessage(null);
  }, [draftKey, durationSec, panelDurationSec, mode, showFullDuration, showPanelDuration]);

  useEffect(() => {
    if (!nativeOverlay || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running && !confirming) onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [nativeOverlay, open, running, confirming, onOpenChange]);

  function handleConfirm() {
    if (mode === "video") {
      const mismatch =
        showFullDuration && onDurationChange
          ? storyboardFullSheetDurationMismatchMessage(draftKey, durationSec)
          : showPanelDuration && panelDurationSec != null
            ? storyboardPanelDurationMismatchMessage(draftKey, panelDurationSec)
            : null;
      if (mismatch) {
        setConfirmBlockMessage(mismatch);
        return;
      }
    }
    setConfirmBlockMessage(null);
    onConfirm(draftKey);
    if (draftKey !== value) onChange(draftKey);
  }

  const platformFlat = models.some((m) => m.platformOffering);

  // BYOK：按 sourceLabel（优先）或 providerKind 分组；平台代付：flat 去重列表
  const groups: { kind: string; models: StoryboardGatewayModel[] }[] = [];
  if (platformFlat) {
    groups.push({ kind: "platform", models: visibleModels });
  } else {
    for (const m of visibleModels) {
      const kind = m.sourceLabel?.trim() || m.providerKind || "UNKNOWN";
      let g = groups.find((x) => x.kind === kind);
      if (!g) {
        g = { kind, models: [] };
        groups.push(g);
      }
      g.models.push(m);
    }
  }

  const hasAnyModel = models.length > 0;
  const filterEmpty = hasAnyModel && visibleModels.length === 0;
  const selectedDraftModel = models.find((m) => m.modelKey === draftKey) ?? null;
  const canConfirm =
    Boolean(
      selectedDraftModel &&
        (selectedDraftModel.credentialBound || selectedDraftModel.platformOffering),
    ) && !filterEmpty;

  const ModeIcon = mode === "image" ? ImageIcon : Video;
  const resolvedTitle = dialogTitle ?? pickerTitle(mode, panelIndex, videoTarget);
  const panelClassName = cn(STORYBOARD_MODEL_PICKER_DIALOG_CLASS, contentClassName);

  const header = (
    <div className="shrink-0 border-b border-[#f0f0f2] px-5 py-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#1d1d1f]">
        <ModeIcon className="h-4 w-4 text-[var(--ecom-primary)]" />
        {resolvedTitle}
      </h2>
      {subtitle ? <p className="text-[12px] text-[#86868b]">{subtitle}</p> : null}
    </div>
  );

  const body = running ? (
    <div className="flex min-h-[min(36dvh,280px)] flex-1 flex-col items-center justify-center gap-4 px-5 py-10">
      <Loader2 className="h-9 w-9 animate-spin text-[var(--ecom-primary)]" />
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-[#1d1d1f]">{runningTitle ?? "处理中…"}</p>
        {runningDetail ? (
          <p className="mt-1.5 text-xs leading-relaxed text-[#86868b]">{runningDetail}</p>
        ) : null}
      </div>
      <div className="ecom-upload-progress ecom-upload-progress-indeterminate w-full max-w-xs">
        <span />
      </div>
    </div>
  ) : (
    <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {modelsLoading && models.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--ecom-primary)]" />
          <p className="text-sm text-[#6e6e73]">正在加载 Gateway 生图模型…</p>
        </div>
      ) : !hasAnyModel ? (
        <div className="grid place-items-center gap-3 px-4 py-10 text-center text-sm text-[#86868b]">
          <p>
            {modelsEmptyHint ??
              `暂无可用${mode === "image" ? "生图" : "视频"}模型，请先在 Gateway 绑定凭证。`}
          </p>
          {onRetryLoadModels ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              onClick={() => void onRetryLoadModels()}
            >
              重新加载模型
            </EcomButtonSecondary>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
          <div className="space-y-4">
            {!hideTypeFilter ? (
              <ModelMediaFilterBar
                mode={mode}
                models={models}
                value={mediaFilter}
                onChange={setMediaFilter}
              />
            ) : null}
            {filterEmpty ? (
              <p className="rounded-xl border border-dashed border-[#e8e8ed] px-4 py-10 text-center text-sm text-[#86868b]">
                当前筛选下暂无模型，请切换类型或选择「全部」。
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.kind}>
                  {!platformFlat ? (
                    <header className="mb-2 flex items-center gap-2">
                      <h3 className="text-[12px] font-semibold text-[#1d1d1f]">{g.kind}</h3>
                    </header>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {g.models.map((m) => (
                      <ModelCard
                        key={m.modelKey}
                        model={m}
                        mode={mode}
                        selected={m.modelKey === draftKey}
                        paramCount={countAdjustableParams(
                          mode,
                          m.modelKey,
                          videoTarget,
                          Boolean(lockedImageSizeLabel),
                        )}
                        durationLabel={modelVideoDurationLabel(mode, m.modelKey, videoTarget)}
                        onSelect={() => setDraftKey(m.modelKey)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <section className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4 lg:sticky lg:top-0">
            <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
              <Cpu className="h-3.5 w-3.5 text-[#86868b]" />
              模型参数
              <span className="font-normal text-[#86868b]">
                {selectedModel?.displayName ?? draftKey}
              </span>
              {mode === "video" && selectedModel ? (
                <span className="rounded bg-[#e8f1ff] px-1.5 py-0.5 text-[10px] font-medium text-[#0058c7]">
                  {formatStoryboardVideoModelTypeLabel(selectedModel.modelKey)}
                </span>
              ) : null}
              {mode === "image" && selectedModel ? (
                <span className="rounded bg-[#fff4e5] px-1.5 py-0.5 text-[10px] font-medium text-[#b25e09]">
                  {formatStoryboardImageModelTypeLabel(selectedModel.modelKey, selectedModel.role)}
                </span>
              ) : null}
            </p>

            <div className="space-y-4">
              {showImageSize && lockedImageSizeLabel ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">{lockedFieldLabel}</span>
                  <p className="rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-sm text-[#1d1d1f]">
                    {lockedImageSizeLabel}
                  </p>
                  <p className="text-[10px] text-[#86868b]">
                    比例由平台/步骤规则锁定；下方可选同比例下的 720P / 1080P / 2K 等具体像素尺寸。
                  </p>
                </div>
              ) : null}

              {showImageSize && klingImageAspectOnly ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">画面比例</span>
                  <select
                    className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                    value={aspectRatio}
                    onChange={(e) =>
                      onAspectRatioChange?.(e.target.value as StoryboardVideoAspectRatio)
                    }
                  >
                    <option value="9:16">9:16 竖屏</option>
                    <option value="16:9">16:9 横屏</option>
                    <option value="1:1">1:1</option>
                  </select>
                </label>
              ) : null}

              {showImageSize && !klingImageAspectOnly ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">
                    {isStoryboardKlingImageModel(draftKey) && hasLockedRatio
                      ? "输出分辨率"
                      : "输出分辨率（尺寸）"}
                  </span>
                  <select
                    className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                    value={imageSize}
                    onChange={(e) => {
                      const next = e.target.value;
                      onImageSizeChange?.(next);
                      const ar = aspectRatioForImageSize(next);
                      if (ar === "16:9" || ar === "9:16" || ar === "1:1") {
                        onAspectRatioChange?.(ar);
                      }
                    }}
                  >
                    {currentImageSizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {isStoryboardKlingImageModel(draftKey) && hasLockedRatio ? (
                    <p className="text-[10px] leading-relaxed text-[#86868b]">
                      可灵 API 不支持 3:4，服务端将映射为最接近比例出图；分辨率可选 1K / 2K。
                    </p>
                  ) : null}
                </label>
              ) : null}

              {showAspect ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">画面比例</span>
                  <select
                    className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                    value={aspectRatio}
                    onChange={(e) =>
                      onAspectRatioChange?.(e.target.value as StoryboardVideoAspectRatio)
                    }
                  >
                    <option value="9:16">9:16 竖屏</option>
                    <option value="16:9">16:9 横屏</option>
                    {isKling30 ? <option value="1:1">1:1</option> : null}
                  </select>
                </label>
              ) : null}

              {showR2vRatio ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">画布比例（百炼 R2V）</span>
                  <select
                    className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                    value={videoR2vRatio}
                    onChange={(e) => onVideoR2vRatioChange?.(e.target.value)}
                  >
                    {STORYBOARD_R2V_RATIO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showResolution ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">视频分辨率</span>
                  <select
                    className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                    value={videoResolution}
                    onChange={(e) =>
                      onVideoResolutionChange?.(e.target.value as StoryboardVideoResolution)
                    }
                  >
                    {currentVideoResolutionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showFullDuration ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">
                    成片时长 {durationSec}s（{fullDurationRange.label}）
                  </span>
                  <input
                    type="range"
                    min={fullDurationMin}
                    max={fullDurationMax}
                    step={1}
                    value={Math.min(fullDurationMax, Math.max(fullDurationMin, durationSec))}
                    onChange={(e) => onDurationChange?.(Number(e.target.value))}
                    className="w-full accent-[var(--ecom-primary)]"
                  />
                  <div className="flex justify-between text-[10px] text-[#86868b]">
                    <span>{fullDurationMin}s</span>
                    <span>{fullDurationMax}s</span>
                  </div>
                </label>
              ) : null}

              {longDurationHintMessage ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  {longDurationHintMessage}
                </p>
              ) : null}

              {confirmBlockMessage ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                  {confirmBlockMessage}
                </p>
              ) : null}

              {showWanR2vExtras ? (
                <label className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                  <input
                    type="checkbox"
                    checked={videoPromptExtend}
                    onChange={(e) => onVideoPromptExtendChange?.(e.target.checked)}
                    className="accent-[var(--ecom-primary)]"
                  />
                  <span>智能扩写提示词（万相 R2V）</span>
                </label>
              ) : null}

              {showR2vSeed ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">随机种子（可选）</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="留空则随机"
                    className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                    value={videoSeed}
                    onChange={(e) => onVideoSeedChange?.(e.target.value)}
                  />
                </label>
              ) : null}

              {showPanelVoiceoverAudio ? (
                <div className="space-y-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
                  <p className="text-xs font-medium text-[#1d1d1f]">口播与音频</p>
                  <p className="text-[11px] leading-relaxed text-[#6e6e73]">
                    口播文案不会自动朗读进视频。推荐先生成无声视频，再在工作区点「批量
                    TTS」对口播单独配音，最后「合成成片」。
                  </p>
                  {showGenerateAudio ? (
                    <label className="flex items-start gap-2 text-sm text-[#1d1d1f]">
                      <input
                        type="checkbox"
                        checked={videoGenerateAudio}
                        onChange={(e) => onVideoGenerateAudioChange?.(e.target.checked)}
                        className="mt-0.5 accent-[var(--ecom-primary)]"
                      />
                      <span className="text-[11px] leading-relaxed">
                        同时生成视频内环境音 / 音效（不含口播朗读）
                      </span>
                    </label>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-[#86868b]">
                      当前模型不生成视频内音效；口播请用「批量 TTS」。
                    </p>
                  )}
                </div>
              ) : showGenerateAudio ? (
                <label className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                  <input
                    type="checkbox"
                    checked={videoGenerateAudio}
                    onChange={(e) => onVideoGenerateAudioChange?.(e.target.checked)}
                    className="accent-[var(--ecom-primary)]"
                  />
                  <span>{generateAudioLabel}</span>
                </label>
              ) : null}

              {showPanelDuration ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6e6e73]">
                    镜头时长 {panelDurationSec}s（{panelDurationRange.label}）
                  </span>
                  <input
                    type="range"
                    min={panelDurationMin}
                    max={panelDurationMax}
                    step={1}
                    value={Math.min(
                      panelDurationMax,
                      Math.max(panelDurationMin, panelDurationSec ?? panelDurationMin),
                    )}
                    onChange={(e) => onPanelDurationChange?.(Number(e.target.value))}
                    className="w-full accent-[var(--ecom-primary)]"
                  />
                  <div className="flex justify-between text-[10px] text-[#86868b]">
                    <span>{panelDurationMin}s</span>
                    <span>{panelDurationMax}s</span>
                  </div>
                </label>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );

  const footer = (
      <div className="flex shrink-0 items-center justify-between border-t border-[#f0f0f2] px-5 py-3">
      <span className="text-[11px] text-[#86868b]">{footerLeftHint}</span>
      <div className="flex items-center gap-2">
        {!running ? (
          <EcomButtonPrimary
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={confirming || !canConfirm}
          >
            {confirming ? "生成中…" : action}
          </EcomButtonPrimary>
        ) : (
          <EcomButtonPrimary type="button" size="sm" disabled>
            {action}…
          </EcomButtonPrimary>
        )}
      </div>
    </div>
  );

  if (nativeOverlay) {
    if (!open || typeof document === "undefined") return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storyboard-model-picker-title"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (Date.now() < suppressBackdropCloseUntilRef.current) return;
          if (running || confirming) return;
          onOpenChange(false);
        }}
      >
        <div
          className={cn(panelClassName, "relative flex flex-col rounded-2xl bg-white shadow-2xl")}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <EcomDialogCloseButton
            disabled={running || confirming}
            onClick={() => onOpenChange(false)}
          />
          <div id="storyboard-model-picker-title">{header}</div>
          {body}
          {footer}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={panelClassName}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <ModeIcon className="h-4 w-4 text-[var(--ecom-primary)]" />
            {resolvedTitle}
          </DialogTitle>
          {subtitle ? <p className="text-[12px] text-[#86868b]">{subtitle}</p> : null}
        </DialogHeader>
        {body}
        <DialogFooter className="shrink-0 items-center justify-between border-t border-[#f0f0f2] px-5 py-3 sm:justify-between">
          <span className="text-[11px] text-[#86868b]">{footerLeftHint}</span>
          <div className="flex items-center gap-2">
            {!running ? (
              <EcomButtonPrimary type="button" size="sm" onClick={handleConfirm} disabled={confirming || !canConfirm}>
                {confirming ? "生成中…" : action}
              </EcomButtonPrimary>
            ) : (
              <EcomButtonPrimary type="button" size="sm" disabled>
                {action}…
              </EcomButtonPrimary>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
