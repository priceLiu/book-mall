"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X, Zap } from "lucide-react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  useClientPortalMounted,
  useModalEscapeClose,
  CANVAS_MODAL_BACKDROP_CLASS,
} from "@/lib/canvas/use-modal-portal-effects";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type {
  Pro2ProductionWizardAssetDraft,
  Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  buildWizardAssetMentionables,
  defaultWizardAssetPrompt,
} from "@/lib/canvas/pro2-production-wizard-assets";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { PRO2_CHARACTER_IMAGE_MODEL_KEYS } from "@/lib/canvas/pro2-three-view-engine";
import { PRO2_SCENE_IMAGE_MODEL_KEYS } from "@/lib/canvas/pro2-scene-batch-image";
import {
  pro2BatchImageAsSbv1Settings,
  sbv1EngineToBatchImage,
} from "@/lib/canvas/pro2-three-view-engine";
import { listPro2WizardCanvasImagePicks } from "@/lib/canvas/pro2-wizard-canvas-image-picks";
import {
  listMissingWizardAssetMentions,
  missingWizardAssetMentionsConfirmCopy,
} from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";
import {
  LIBTV_DOCK_TOOLBAR_SCREEN_SCALE,
  LibtvDockToolbarMetricsContext,
} from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import {
  coerceSbv1ImageAspectForModel,
  type Sbv1ImageAspectRatio,
} from "@/lib/canvas/sbv1-image-models";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";
import { MediaHoverBox } from "@/components/canvas/media-hover-box";
import { LibtvToolbarDropdownZProvider } from "../../sbv1/sbv1-toolbar-anchor-popover";
import {
  Sbv1ImageDockModelPicker,
  Sbv1ImageDockParamsPicker,
} from "../../sbv1/sbv1-image-dock-pickers";
import { Pro2WizardRefImageZone } from "./pro2-wizard-ref-image-zone";
import {
  PRO2_WIZARD_MENTIONS_CLASS,
} from "./pro2-production-wizard-chrome";

export type Pro2ProductionWizardAssetStudioModalProps = {
  open: boolean;
  onClose: () => void;
  kind: Pro2WizardAssetKind;
  assetId: string;
  title: string;
  scriptHubId: string;
  script?: Pro2ProductionScript;
  initialPrompt: string;
  initialRefImages: StoryRefImage[];
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  previewUrl?: string;
  generateStatus?: Pro2ProductionWizardAssetDraft["generateStatus"];
  onEnqueueGenerate?: (payload: {
    settings: Sbv1ImageNodeData;
    prompt: string;
    refImages: StoryRefImage[];
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
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

type StudioTab = "ai" | "canvas";

const KIND_LABEL: Record<Pro2WizardAssetKind, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

const TAB_LABEL: Record<StudioTab, string> = {
  ai: "AI 生成",
  canvas: "从当前画布选择",
};

function allowedKeysForKind(kind: Pro2WizardAssetKind): string[] {
  if (kind === "character") return [...PRO2_CHARACTER_IMAGE_MODEL_KEYS];
  return [...PRO2_SCENE_IMAGE_MODEL_KEYS];
}

function defaultAspectForKind(kind: Pro2WizardAssetKind): Sbv1ImageAspectRatio {
  if (kind === "character") return "16:9";
  if (kind === "scene") return "16:9";
  return "1:1";
}

function coerceWizardAssetSettings(
  kind: Pro2WizardAssetKind,
  batchImage: { providerId?: string; modelKey?: string; params?: Record<string, unknown> } | null | undefined,
  defaults?: Partial<Sbv1ImageNodeData>,
): Sbv1ImageNodeData {
  const base = pro2BatchImageAsSbv1Settings(batchImage, {
    aspectRatio: defaultAspectForKind(kind),
    imageQuality: "standard",
    resolution: "2K",
    outputCount: 1,
    ...defaults,
  });
  const modelKey = base.engine?.modelKey?.trim() ?? "";
  if (!modelKey) return base;
  const aspectRatio = coerceSbv1ImageAspectForModel(
    modelKey,
    base.aspectRatio ?? defaultAspectForKind(kind),
  );
  if (aspectRatio === base.aspectRatio) return base;
  return { ...base, aspectRatio };
}

export function Pro2ProductionWizardAssetStudioModal({
  open,
  onClose,
  kind,
  assetId,
  title,
  scriptHubId,
  script,
  initialPrompt,
  initialRefImages,
  providerId,
  modelKey,
  params,
  previewUrl,
  generateStatus,
  onEnqueueGenerate,
  onSave,
}: Pro2ProductionWizardAssetStudioModalProps) {
  const mounted = useClientPortalMounted();
  const { alert, confirm } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);

  const [tab, setTab] = useState<StudioTab>("ai");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [refImages, setRefImages] = useState(initialRefImages);
  const [settingsData, setSettingsData] = useState<Sbv1ImageNodeData>(() =>
    coerceWizardAssetSettings(
      kind,
      { providerId, modelKey, params },
      { aspectRatio: defaultAspectForKind(kind) },
    ),
  );
  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);
  const [canvasPickUrl, setCanvasPickUrl] = useState<string>("");

  const initRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initRef.current = false;
      return;
    }
    if (initRef.current) return;
    initRef.current = true;
    setTab("ai");
    setPrompt(initialPrompt);
    setRefImages(initialRefImages);
    setSettingsData(
      coerceWizardAssetSettings(
        kind,
        { providerId, modelKey, params },
        { aspectRatio: defaultAspectForKind(kind) },
      ),
    );
    setDockMenu(null);
    setCanvasPickUrl(previewUrl ?? "");
  }, [
    open,
    initialPrompt,
    initialRefImages,
    providerId,
    modelKey,
    params,
    previewUrl,
    kind,
  ]);

  useModalEscapeClose(onClose, { active: open });

  const canvasPicks = useMemo(
    () => listPro2WizardCanvasImagePicks(nodes),
    [nodes],
  );

  const assetDrafts = useMemo(() => {
    const hub = nodes.find((n) => n.id === scriptHubId);
    return (hub?.data as StoryProScriptHubNodeData | undefined)
      ?.productionWizardAssetDrafts;
  }, [nodes, scriptHubId]);

  const mentionables = useMemo(
    () =>
      buildWizardAssetMentionables(
        script,
        refImages,
        { kind, assetId },
        assetDrafts,
      ),
    [script, refImages, kind, assetId, assetDrafts],
  );

  const batchImage = useMemo(
    () => sbv1EngineToBatchImage(settingsData),
    [settingsData],
  );
  const hasModel = Boolean(batchImage);

  const estCredits = useModelCreditsPreview(
    batchImage?.modelKey,
    0,
    undefined,
    settingsData.outputCount ?? 1,
    settingsData.resolution,
  );

  const patchSettings = useCallback((patch: Partial<Sbv1ImageNodeData>) => {
    setSettingsData((prev) => {
      const next = { ...prev, ...patch };
      const modelKey =
        patch.engine?.modelKey?.trim() ??
        next.engine?.modelKey?.trim() ??
        "";
      if (!modelKey) return next;
      const aspectRatio = coerceSbv1ImageAspectForModel(
        modelKey,
        next.aspectRatio ?? defaultAspectForKind(kind),
      );
      return aspectRatio === next.aspectRatio ? next : { ...next, aspectRatio };
    });
  }, [kind]);

  const persistDraft = useCallback(
    (nextPreviewUrl?: string) => {
      if (!batchImage) return null;
      onSave({
        prompt: prompt.trim(),
        refImages,
        providerId: batchImage.providerId,
        modelKey: batchImage.modelKey,
        params: batchImage.params ?? {},
        previewUrl: nextPreviewUrl,
      });
      return batchImage;
    },
    [batchImage, onSave, prompt, refImages],
  );

  const onConfirmGenerate = useCallback(async () => {
    if (generateStatus === "running") {
      await alert({
        title: "正在出图中",
        message: "该资产已在后台生成，请稍候或继续编辑其他资产。",
        variant: "warning",
      });
      return;
    }

    if (tab === "canvas") {
      if (!canvasPickUrl.trim()) {
        await alert({
          title: "请选择图片",
          message: "从画布缩略图中点选一张图片后再确认。",
          variant: "warning",
        });
        return;
      }
      persistDraft(canvasPickUrl.trim());
      onClose();
      return;
    }

    if (!hasModel) {
      await alert({
        title: "请先选择图片模型",
        message: "在底部选择出图模型与参数后再生成。",
        variant: "warning",
      });
      return;
    }

    if (!prompt.trim() && !refImages.some((r) => r.url?.trim())) {
      await alert({
        title: "请输入提示词",
        message: "请填写提示词，或上传参考图后再生成。",
        variant: "warning",
      });
      return;
    }

    if (!onEnqueueGenerate) {
      await alert({
        title: "无法出图",
        message: "画布未就绪，请刷新后重试。",
        variant: "error",
      });
      return;
    }

    if (!batchImage) return;

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

    persistDraft();
    const queued = onEnqueueGenerate({
      settings: settingsData,
      prompt,
      refImages,
      providerId: batchImage.providerId,
      modelKey: batchImage.modelKey,
      params: batchImage.params ?? {},
    });
    if (!queued) {
      await alert({
        title: "正在出图中",
        message: "该资产已在后台生成，请稍候。",
        variant: "warning",
      });
      return;
    }
    onClose();
  }, [
    alert,
    assetDrafts,
    batchImage,
    canvasPickUrl,
    confirm,
    generateStatus,
    hasModel,
    onClose,
    onEnqueueGenerate,
    persistDraft,
    prompt,
    refImages,
    script,
    settingsData,
    tab,
  ]);

  if (!mounted || !open) return null;

  return createPortal(
    <LibtvToolbarDropdownZProvider zIndex={LIBTV_GENERATE_SETTINGS_MODAL_Z + 10}>
      <div
        className={cn(CANVAS_MODAL_BACKDROP_CLASS, "p-4")}
        style={{
          zIndex: LIBTV_GENERATE_SETTINGS_MODAL_Z,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`选择图片 · ${title}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="nodrag nowheel flex h-[min(640px,82vh)] w-[min(920px,92vw)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl"
          style={{ backgroundColor: ENGINE_PICKER_MODAL_BG }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-white">
                选择图片（{title}）
              </p>
              <p className="truncate text-[11px] text-white/45">
                {KIND_LABEL[kind]} · AI 生成 / 画布选图
              </p>
            </div>
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-md text-white/50 hover:bg-white/8 hover:text-white"
              aria-label="关闭"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex shrink-0 gap-6 border-b border-white/[0.06] px-5">
            {(["ai", "canvas"] as StudioTab[]).map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "relative py-2.5 text-[13px] transition",
                  tab === id
                    ? "font-medium text-white"
                    : "text-white/45 hover:text-white/70",
                )}
                onClick={() => setTab(id)}
              >
                {TAB_LABEL[id]}
                {tab === id ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />
                ) : null}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {tab === "ai" ? (
              <div className="flex h-full min-h-[280px] flex-col gap-3">
                <section className="shrink-0">
                  <p className="mb-1.5 text-[10px] font-medium text-white/55">
                    参考图
                  </p>
                  <Pro2WizardRefImageZone
                    refs={refImages}
                    onChange={setRefImages}
                    maxCount={9}
                    disabled={generateStatus === "running"}
                  />
                </section>
                <section className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-1.5 shrink-0 text-[10px] font-medium text-white/55">
                    提示词
                  </p>
                  <MentionsEditable
                    className={cn(
                      RF_FORM_CONTROL,
                      RF_NO_WHEEL,
                      PRO2_WIZARD_MENTIONS_CLASS,
                      "min-h-[220px] flex-1",
                    )}
                    placeholder="输入生图提示词，@ 引用角色 / 场景 / 道具或参考图"
                    value={prompt}
                    mentionables={mentionables}
                    mentionEdition="wizard"
                    disabled={generateStatus === "running"}
                    onChange={setPrompt}
                  />
                </section>
              </div>
            ) : null}

            {tab === "canvas" ? (
              canvasPicks.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                  {canvasPicks.map((pick) => {
                    const selected = canvasPickUrl === pick.url;
                    return (
                      <div
                        key={`${pick.nodeId}-${pick.url}`}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "cursor-pointer overflow-hidden rounded-xl border text-left transition outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
                          selected
                            ? "border-violet-400 ring-1 ring-violet-400/40"
                            : "border-white/10 hover:border-white/25",
                        )}
                        onClick={() => setCanvasPickUrl(pick.url)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setCanvasPickUrl(pick.url);
                          }
                        }}
                      >
                        <div className="aspect-video bg-black/40">
                          <MediaHoverBox
                            src={pick.url}
                            alt={pick.label}
                            fit="cover"
                            variant="generated"
                            previewChrome="ecom"
                            className="size-full"
                          />
                        </div>
                        <p className="truncate px-2 py-1.5 text-[11px] text-zinc-300">
                          {pick.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-white/40">
                  <ImagePlus className="size-10" strokeWidth={1.25} />
                  <p className="text-sm">画布上暂无可选图片</p>
                  <p className="text-[11px] text-white/30">
                    请先在画布生成图片，再回来选择
                  </p>
                </div>
              )
            ) : null}
          </div>

          <footer className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-black/25 px-5 py-3">
            {tab === "ai" ? (
              <LibtvDockToolbarMetricsContext.Provider
                value={LIBTV_DOCK_TOOLBAR_SCREEN_SCALE}
              >
                <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-1 py-1">
                  <Sbv1ImageDockModelPicker
                    data={settingsData}
                    allowedModelKeys={allowedKeysForKind(kind)}
                    open={dockMenu === "model"}
                    onOpenChange={(next) => setDockMenu(next ? "model" : null)}
                    onPatch={patchSettings}
                    dropdownPlacement="above"
                  />
                  <Sbv1ImageDockParamsPicker
                    data={settingsData}
                    open={dockMenu === "params"}
                    onOpenChange={(next) => setDockMenu(next ? "params" : null)}
                    onPatch={patchSettings}
                    dropdownPlacement="above"
                  />
                </div>
              </LibtvDockToolbarMetricsContext.Provider>
            ) : (
              <p className="text-[11px] text-white/40">
                选中画布图片后点「确认生成」设为资产预览
              </p>
            )}

            <div className="flex shrink-0 items-center gap-3">
              {tab === "ai" && estCredits?.credits != null ? (
                <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-yellow-300">
                  <Zap className="size-3.5" />
                  {Math.round(estCredits.credits)}
                </span>
              ) : null}
              <button
                type="button"
                className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-black transition hover:bg-zinc-100 disabled:opacity-50"
                disabled={(tab === "ai" && !hasModel) || generateStatus === "running"}
                onClick={() => void onConfirmGenerate()}
              >
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

export function resolveWizardAssetDefaultPrompt(
  kind: Pro2WizardAssetKind,
  assetId: string,
  script?: Pro2ProductionScript,
): string {
  if (!script) return "";
  if (kind === "character") {
    const hit = script.characters?.find((c) => c.id === assetId);
    return hit ? defaultWizardAssetPrompt(kind, hit) : "";
  }
  if (kind === "scene") {
    const hit = script.scenes?.find((s) => s.id === assetId);
    return hit ? defaultWizardAssetPrompt(kind, hit) : "";
  }
  const hit = script.props?.find((p) => p.id === assetId);
  return hit ? defaultWizardAssetPrompt(kind, hit) : "";
}
