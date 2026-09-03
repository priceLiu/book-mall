"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Zap } from "lucide-react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  useClientPortalMounted,
  useModalEscapeClose,
  CANVAS_MODAL_BACKDROP_CLASS,
} from "@/lib/canvas/use-modal-portal-effects";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { Pro2ProductionWizardShotDraft } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import {
  WIZARD_SHOT_MEDIA_LABEL,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { buildWizardAssetMentionables } from "@/lib/canvas/pro2-production-wizard-assets";
import { prepareWizardShotEditorState } from "@/lib/canvas/pro2-frame-shot-ref-prep";
import { resolveWizardShotFromScript } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  buildWizardMentionRefCatalog,
  isWizardAssetMentionId,
  listMissingWizardAssetMentions,
  mergeWizardMentionRefImages,
  missingWizardAssetMentionsConfirmCopy,
} from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import { PRO2_FRAME_IMAGE_MODEL_KEYS } from "@/lib/canvas/pro2-frame-batch-image";
import {
  pro2BatchImageAsSbv1Settings,
  sbv1EngineToBatchImage,
} from "@/lib/canvas/pro2-three-view-engine";
import { coerceSbv1ImageAspectForModel } from "@/lib/canvas/sbv1-image-models";
import type {
  Sbv1ImageNodeData,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";
import { SBV1_DEFAULT_VIDEO_ENGINE_DATA } from "@/lib/canvas/sbv1-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";
import {
  LIBTV_DOCK_TOOLBAR_SCREEN_SCALE,
  LibtvDockToolbarMetricsContext,
} from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import { cn } from "@/lib/utils";
import { LibtvToolbarDropdownZProvider } from "../../sbv1/sbv1-toolbar-anchor-popover";
import {
  Sbv1ImageDockModelPicker,
  Sbv1ImageDockParamsPicker,
} from "../../sbv1/sbv1-image-dock-pickers";
import {
  Sbv1VideoDockModelPicker,
  Sbv1VideoDockParamsPicker,
} from "../../sbv1/sbv1-video-dock-pickers";
import { Pro2WizardRefImageZone } from "./pro2-wizard-ref-image-zone";
import {
  PRO2_WIZARD_PROMPT_MENTIONS_CLASS,
} from "./pro2-production-wizard-chrome";

export type Pro2ProductionWizardShotStudioModalProps = {
  open: boolean;
  onClose: () => void;
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
  scriptHubId: string;
  script?: Pro2ProductionScript;
  initialPrompt: string;
  initialRefImages: StoryRefImage[];
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  previewUrl?: string;
  framePreviewUrl?: string;
  generateStatus?: Pro2ProductionWizardShotDraft["generateStatus"];
  onEnqueueGenerate?: (payload: {
    prompt: string;
    refImages: StoryRefImage[];
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
    frameSettings?: Sbv1ImageNodeData;
  }) => boolean;
  onSave: (patch: {
    prompt: string;
    refImages: StoryRefImage[];
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
    previewUrl?: string;
  }) => void;
};

function coerceFrameSettings(
  batchImage: { providerId?: string; modelKey?: string; params?: Record<string, unknown> } | null,
): Sbv1ImageNodeData {
  return pro2BatchImageAsSbv1Settings(batchImage, {
    aspectRatio: "16:9",
    imageQuality: "standard",
    resolution: "2K",
    outputCount: 1,
  });
}

export function Pro2ProductionWizardShotStudioModal({
  open,
  onClose,
  mediaKind,
  shotIndex,
  scriptHubId,
  script,
  initialPrompt,
  initialRefImages,
  providerId,
  modelKey,
  params,
  previewUrl,
  framePreviewUrl,
  generateStatus,
  onEnqueueGenerate,
  onSave,
}: Pro2ProductionWizardShotStudioModalProps) {
  const mounted = useClientPortalMounted();
  const { alert, confirm } = useDialogs();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [refImages, setRefImages] = useState(initialRefImages);
  const [frameSettings, setFrameSettings] = useState<Sbv1ImageNodeData>(() =>
    coerceFrameSettings({ providerId, modelKey, params }),
  );
  const [videoData, setVideoData] = useState<Sbv1VideoEngineNodeData>(() => ({
    ...SBV1_DEFAULT_VIDEO_ENGINE_DATA,
    engine: {
      providerId: providerId || SBV1_DEFAULT_VIDEO_ENGINE_DATA.engine.providerId,
      modelKey: modelKey || SBV1_DEFAULT_VIDEO_ENGINE_DATA.engine.modelKey,
      params: params ?? SBV1_DEFAULT_VIDEO_ENGINE_DATA.engine.params,
    },
  }));
  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);
  const initRef = useRef(false);

  const assetDrafts = useCanvasStore((s) => {
    const hub = s.nodes.find((n) => n.id === scriptHubId);
    return (hub?.data as StoryProScriptHubNodeData | undefined)
      ?.productionWizardAssetDrafts;
  });

  useEffect(() => {
    if (!open) {
      initRef.current = false;
      return;
    }
    if (initRef.current) return;
    initRef.current = true;

    const shot = resolveWizardShotFromScript(script, shotIndex);
    if (shot && script) {
      const prepared = prepareWizardShotEditorState({
        prompt: initialPrompt,
        mediaKind,
        script,
        shot,
        assetDrafts,
      });
      const manualRefs = initialRefImages.filter(
        (r) => !isWizardAssetMentionId(r.id),
      );
      const catalog = buildWizardMentionRefCatalog(assetDrafts, prepared.refImages);
      setPrompt(prepared.prompt);
      setRefImages(
        mergeWizardMentionRefImages(
          prepared.prompt,
          catalog,
          [...prepared.refImages, ...manualRefs],
        ),
      );
    } else {
      setPrompt(initialPrompt);
      setRefImages(initialRefImages);
    }

    if (mediaKind === "frame") {
      setFrameSettings(coerceFrameSettings({ providerId, modelKey, params }));
    } else {
      setVideoData({
        ...SBV1_DEFAULT_VIDEO_ENGINE_DATA,
        engine: {
          providerId: providerId || SBV1_DEFAULT_VIDEO_ENGINE_DATA.engine.providerId,
          modelKey: modelKey || SBV1_DEFAULT_VIDEO_ENGINE_DATA.engine.modelKey,
          params: params ?? SBV1_DEFAULT_VIDEO_ENGINE_DATA.engine.params,
        },
      });
    }
    setDockMenu(null);
  }, [
    open,
    initialPrompt,
    initialRefImages,
    providerId,
    modelKey,
    params,
    mediaKind,
    script,
    shotIndex,
    assetDrafts,
  ]);

  useModalEscapeClose(onClose, { active: open });

  const mentionables = useMemo(
    () => buildWizardAssetMentionables(script, refImages, undefined, assetDrafts),
    [script, refImages, assetDrafts],
  );

  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      if (!script) return;
      setRefImages((prev) => {
        const catalog = buildWizardMentionRefCatalog(assetDrafts, prev);
        return mergeWizardMentionRefImages(value, catalog, prev);
      });
    },
    [script, assetDrafts],
  );

  const batchImage = useMemo(
    () => (mediaKind === "frame" ? sbv1EngineToBatchImage(frameSettings) : null),
    [frameSettings, mediaKind],
  );

  const estCredits = useModelCreditsPreview(
    mediaKind === "frame" ? batchImage?.modelKey : videoData.engine.modelKey,
    0,
    undefined,
    frameSettings.outputCount ?? 1,
    frameSettings.resolution,
  );

  const persistDraft = useCallback(() => {
    if (mediaKind === "frame") {
      if (!batchImage) return null;
      onSave({
        prompt: prompt.trim(),
        refImages,
        providerId: batchImage.providerId,
        modelKey: batchImage.modelKey,
        params: batchImage.params ?? {},
        previewUrl,
      });
      return batchImage;
    }
    const engine = videoData.engine;
    onSave({
      prompt: prompt.trim(),
      refImages,
      providerId: engine.providerId,
      modelKey: engine.modelKey,
      params: engine.params ?? {},
      previewUrl,
    });
    return engine;
  }, [
    batchImage,
    mediaKind,
    onSave,
    previewUrl,
    prompt,
    refImages,
    videoData.engine,
  ]);

  const onConfirmGenerate = useCallback(async () => {
    if (generateStatus === "running") {
      await alert({
        title: "正在生成",
        message: "该镜已在后台生成，请稍候或继续编辑其他镜。",
        variant: "warning",
      });
      return;
    }

    if (mediaKind === "video" && !framePreviewUrl?.trim()) {
      await alert({
        title: "需要分镜图",
        message: "请先生成该镜的分镜图，再生成视频。",
        variant: "warning",
      });
      return;
    }

    if (!prompt.trim() && mediaKind === "video") {
      await alert({
        title: "请输入视频提示词",
        message: "请填写分镜视频提示词后再生成。",
        variant: "warning",
      });
      return;
    }

    if (
      mediaKind === "frame" &&
      !prompt.trim() &&
      !refImages.some((r) => r.url?.trim())
    ) {
      await alert({
        title: "请输入提示词",
        message: "请填写提示词，或上传参考图后再生成。",
        variant: "warning",
      });
      return;
    }

    if (!onEnqueueGenerate) {
      await alert({
        title: "无法生成",
        message: "画布未就绪，请刷新后重试。",
        variant: "error",
      });
      return;
    }

    const saved = persistDraft();
    if (!saved) {
      await alert({
        title: "请先选择模型",
        message: "在底部选择模型与参数后再生成。",
        variant: "warning",
      });
      return;
    }

    const missingAssets = listMissingWizardAssetMentions(
      prompt,
      script,
      assetDrafts,
    );
    if (missingAssets.length) {
      const copy = missingWizardAssetMentionsConfirmCopy(missingAssets);
      if (
        !(await confirm({
          ...copy,
          confirmLabel: "仍要生成",
          cancelLabel: "返回补出图",
        }))
      ) {
        return;
      }
    }

    const queued =
      mediaKind === "frame"
        ? onEnqueueGenerate({
            prompt,
            refImages,
            providerId: batchImage!.providerId,
            modelKey: batchImage!.modelKey,
            params: batchImage!.params ?? {},
            frameSettings,
          })
        : onEnqueueGenerate({
            prompt,
            refImages,
            providerId: videoData.engine.providerId,
            modelKey: videoData.engine.modelKey,
            params: videoData.engine.params ?? {},
          });

    if (!queued) {
      await alert({
        title: "无法提交生成",
        message: "请检查网络与主站连接，或稍后再试。",
        variant: "warning",
      });
      return;
    }
    onClose();
  }, [
    alert,
    assetDrafts,
    batchImage,
    confirm,
    framePreviewUrl,
    frameSettings,
    generateStatus,
    mediaKind,
    onClose,
    onEnqueueGenerate,
    persistDraft,
    prompt,
    refImages,
    script,
    videoData.engine,
  ]);

  if (!mounted || !open) return null;

  const title = `镜 ${shotIndex} · ${WIZARD_SHOT_MEDIA_LABEL[mediaKind]}`;

  return createPortal(
    <LibtvToolbarDropdownZProvider zIndex={LIBTV_GENERATE_SETTINGS_MODAL_Z + 10}>
      <div
        className={cn(CANVAS_MODAL_BACKDROP_CLASS, "p-4")}
        style={{
          zIndex: LIBTV_GENERATE_SETTINGS_MODAL_Z,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="nodrag nowheel relative flex h-[clamp(16rem,50vh,calc(100vh-1.5rem))] w-[clamp(20rem,50vw,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl"
          style={{ backgroundColor: ENGINE_PICKER_MODAL_BG }}
          onMouseDown={(e) => e.stopPropagation()}
        >
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-100">{title}</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              编辑提示词与参考图 · 确认后后台生成
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {mediaKind === "video" && !framePreviewUrl?.trim() ? (
            <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              请先在左侧分镜图卡片生成该镜静帧，再生成视频。
            </p>
          ) : null}

          <label className="mb-2 block text-xs font-medium text-zinc-400">
            提示词
          </label>
          <MentionsEditable
            className={cn(
              PRO2_WIZARD_PROMPT_MENTIONS_CLASS,
              RF_FORM_CONTROL,
              RF_NO_WHEEL,
              "min-h-[88px] w-full",
            )}
            value={prompt}
            onChange={handlePromptChange}
            mentionables={mentionables}
            mentionEdition="wizard"
            mentionInlineThumb
            mentionInlineThumbHoverOnText
            placeholder="输入提示词，输入 @ 引用资产"
          />

          <div className="mt-3">
            <Pro2WizardRefImageZone
              refs={refImages}
              onChange={setRefImages}
            />
          </div>
        </div>

        <footer className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-black/25 px-4 py-2.5">
          <LibtvDockToolbarMetricsContext.Provider
            value={LIBTV_DOCK_TOOLBAR_SCREEN_SCALE}
          >
            <LibtvToolbarDropdownZProvider zIndex={LIBTV_GENERATE_SETTINGS_MODAL_Z + 20}>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-1 py-1">
                {mediaKind === "frame" ? (
                  <>
                    <Sbv1ImageDockModelPicker
                      open={dockMenu === "model"}
                      onOpenChange={(v) => setDockMenu(v ? "model" : null)}
                      data={frameSettings}
                      onPatch={(patch) =>
                        setFrameSettings((prev) => {
                          const next = { ...prev, ...patch };
                          const mk =
                            patch.engine?.modelKey?.trim() ??
                            next.engine?.modelKey?.trim() ??
                            "";
                          if (!mk) return next;
                          const ar = coerceSbv1ImageAspectForModel(
                            mk,
                            next.aspectRatio ?? "16:9",
                          );
                          return ar === next.aspectRatio
                            ? next
                            : { ...next, aspectRatio: ar };
                        })
                      }
                      allowedModelKeys={PRO2_FRAME_IMAGE_MODEL_KEYS}
                      dropdownPlacement="above"
                    />
                    <Sbv1ImageDockParamsPicker
                      open={dockMenu === "params"}
                      onOpenChange={(v) => setDockMenu(v ? "params" : null)}
                      data={frameSettings}
                      onPatch={(patch) =>
                        setFrameSettings((prev) => ({ ...prev, ...patch }))
                      }
                      dropdownPlacement="above"
                    />
                  </>
                ) : (
                  <>
                    <Sbv1VideoDockModelPicker
                      open={dockMenu === "model"}
                      onOpenChange={(v) => setDockMenu(v ? "model" : null)}
                      data={videoData}
                      onPatch={(patch) =>
                        setVideoData((prev) => ({ ...prev, ...patch }))
                      }
                      refLinkCount={framePreviewUrl?.trim() ? 1 : 0}
                    />
                    <Sbv1VideoDockParamsPicker
                      open={dockMenu === "params"}
                      onOpenChange={(v) => setDockMenu(v ? "params" : null)}
                      data={videoData}
                      onPatch={(patch) =>
                        setVideoData((prev) => ({ ...prev, ...patch }))
                      }
                    />
                  </>
                )}
              </div>
            </LibtvToolbarDropdownZProvider>
          </LibtvDockToolbarMetricsContext.Provider>

          <div className="flex shrink-0 items-center gap-2">
            {estCredits?.credits != null ? (
              <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-yellow-300">
                <Zap className="size-3.5" />
                {Math.round(estCredits.credits)}
              </span>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/5"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-500"
              onClick={() => void onConfirmGenerate()}
            >
              <Zap className="size-3.5" />
              确认生成
            </button>
          </div>
        </footer>
        </div>
      </div>
    </LibtvToolbarDropdownZProvider>,
    document.body,
  );
}
