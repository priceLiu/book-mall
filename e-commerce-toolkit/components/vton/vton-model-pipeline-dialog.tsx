"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { EcomGenerateCreditsBeside } from "@/components/billing/ecom-generate-credits-beside";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  ecomModalBackdropMouseDown,
  useEcomModalEscape,
} from "@/components/ui/ecom-modal-layer";
import { VtonImageQualityPicker } from "@/components/vton/vton-image-quality-picker";
import { fetchModelTryonModels, type VtonModelPipelineRequest } from "@/lib/ecom-model-tryon-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { coerceVtonModelImageSize, type VtonModelImageSize } from "@/lib/vton-image-quality";
import { VTON_MODEL_DEFAULT_PROMPT } from "@/lib/vton-model-prompts";
import {
  coerceVtonModelAgeGroupId,
  coerceVtonModelBodyPresetId,
  coerceVtonModelPipelineRatio,
  VTON_MODEL_AGE_GROUP_OPTIONS,
  VTON_MODEL_BODY_PRESET_OPTIONS,
  VTON_MODEL_PIPELINE_RATIO_OPTIONS,
  type VtonModelPipelineRatio,
} from "@/lib/vton-model-pipeline-presets";
import { cn } from "@/lib/utils";

export type VtonModelPipelineDialogMode = "generate" | "expand";

export type VtonModelPipelineInitial = {
  prompt?: string;
  imageSize?: string;
  modelKey?: string;
  ratio?: string;
  bodyPreset?: string;
  ageGroup?: string;
  featureDetail?: string;
  heightCm?: string;
  weightKg?: string;
  bustCm?: string;
  waistCm?: string;
  hipsCm?: string;
};

type Props = {
  open: boolean;
  mode: VtonModelPipelineDialogMode;
  onClose: () => void;
  busy?: boolean;
  imageModels?: StoryboardGatewayModel[];
  defaultModelKey?: string;
  modelsLoading?: boolean;
  initial?: VtonModelPipelineInitial;
  onConfirm: (
    mode: VtonModelPipelineDialogMode,
    opts: VtonModelPipelineRequest,
  ) => void | Promise<void>;
};

type Panel = "form" | "models";

const MODE_COPY: Record<
  VtonModelPipelineDialogMode,
  { title: string; hint: string; promptLabel: string; confirm: string }
> = {
  generate: {
    title: "AI 生全身模特",
    hint: "选择精度、比例、体型与模型，可编辑 Prompt 后生成白底全身素模。",
    promptLabel: "生图 Prompt（可微调）",
    confirm: "开始生成",
  },
  expand: {
    title: "头像生成全身图",
    hint: "在保留参考人像身份的前提下扩展为全身；参数与「AI 生模特」一致。",
    promptLabel: "补充描述（可选）",
    confirm: "开始扩全身",
  },
};

function metricInputClass(disabled?: boolean): string {
  return cn(
    "w-full rounded-md border border-[#e8e8ed] px-2 py-1.5 text-[11px] text-[#1d1d1f] outline-none focus:border-[#0071e3]",
    disabled && "cursor-not-allowed bg-[#f5f5f7] opacity-60",
  );
}

export function VtonModelPipelineDialog({
  open,
  mode,
  onClose,
  busy,
  imageModels = [],
  defaultModelKey = "",
  modelsLoading = false,
  initial,
  onConfirm,
}: Props) {
  const copy = MODE_COPY[mode];
  const [panel, setPanel] = useState<Panel>("form");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [imageSize, setImageSize] = useState<VtonModelImageSize>("720*960");
  const [ratio, setRatio] = useState<VtonModelPipelineRatio>("3:4");
  const [bodyPreset, setBodyPreset] = useState(coerceVtonModelBodyPresetId("standard"));
  const [ageGroup, setAgeGroup] = useState(coerceVtonModelAgeGroupId("youth"));
  const [featureDetail, setFeatureDetail] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bustCm, setBustCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [draftModelKey, setDraftModelKey] = useState(defaultModelKey);
  const [localImageModels, setLocalImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localLoadError, setLocalLoadError] = useState<string | null>(null);

  const effectiveImageModels = imageModels.length > 0 ? imageModels : localImageModels;
  const showModelsLoading =
    (modelsLoading || localLoading) && effectiveImageModels.length === 0;

  const refreshModels = useCallback(async () => {
    setLocalLoading(true);
    setLocalLoadError(null);
    try {
      const payload = await fetchModelTryonModels();
      setLocalImageModels(payload.imageModels ?? []);
      if ((payload.imageModels ?? []).length === 0) {
        setLocalLoadError("Gateway 未返回可用 IMAGE 模型，请检查凭证或模型上架。");
      }
    } catch (e) {
      setLocalLoadError(e instanceof Error ? e.message : "模型列表加载失败");
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPanel("form");
    setDraftPrompt(
      mode === "generate"
        ? initial?.prompt?.trim() || VTON_MODEL_DEFAULT_PROMPT
        : initial?.prompt?.trim() || "",
    );
    setImageSize(coerceVtonModelImageSize(initial?.imageSize));
    setRatio(coerceVtonModelPipelineRatio(initial?.ratio));
    setBodyPreset(coerceVtonModelBodyPresetId(initial?.bodyPreset));
    setAgeGroup(coerceVtonModelAgeGroupId(initial?.ageGroup));
    setFeatureDetail(initial?.featureDetail?.trim() ?? "");
    setHeightCm(initial?.heightCm?.trim() ?? "");
    setWeightKg(initial?.weightKg?.trim() ?? "");
    setBustCm(initial?.bustCm?.trim() ?? "");
    setWaistCm(initial?.waistCm?.trim() ?? "");
    setHipsCm(initial?.hipsCm?.trim() ?? "");
    setDraftModelKey(initial?.modelKey?.trim() || defaultModelKey);
    setLocalLoadError(null);
  }, [open, mode, initial, defaultModelKey]);

  useEffect(() => {
    if (!open || imageModels.length > 0) return;
    void refreshModels();
  }, [open, imageModels.length, refreshModels]);

  useEffect(() => {
    if (effectiveImageModels.length === 0) return;
    setDraftModelKey((prev) =>
      pickBoundStoryboardModelKey(
        effectiveImageModels,
        effectiveImageModels.some((m) => m.modelKey === prev)
          ? prev
          : defaultModelKey || effectiveImageModels[0]!.modelKey,
      ),
    );
  }, [effectiveImageModels, defaultModelKey]);

  useEcomModalEscape(open, onClose, { disabled: busy });

  const selectedModelName = useMemo(
    () =>
      effectiveImageModels.find((m) => m.modelKey === draftModelKey)?.displayName ??
      draftModelKey,
    [draftModelKey, effectiveImageModels],
  );

  const buildRequest = useCallback((): VtonModelPipelineRequest => {
    const prompt = draftPrompt.trim();
    return {
      ...(prompt ? { prompt } : {}),
      imageSize,
      modelKey: draftModelKey.trim() || undefined,
      ratio,
      bodyPreset,
      ageGroup,
      ...(featureDetail.trim() ? { featureDetail: featureDetail.trim() } : {}),
      ...(heightCm.trim() ? { heightCm: heightCm.trim() } : {}),
      ...(weightKg.trim() ? { weightKg: weightKg.trim() } : {}),
      ...(bustCm.trim() ? { bustCm: bustCm.trim() } : {}),
      ...(waistCm.trim() ? { waistCm: waistCm.trim() } : {}),
      ...(hipsCm.trim() ? { hipsCm: hipsCm.trim() } : {}),
    };
  }, [
    ageGroup,
    bodyPreset,
    bustCm,
    draftModelKey,
    draftPrompt,
    featureDetail,
    heightCm,
    hipsCm,
    imageSize,
    ratio,
    waistCm,
    weightKg,
  ]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vton-model-pipeline-title"
      onMouseDown={ecomModalBackdropMouseDown(onClose, { disabled: busy })}
    >
      <div className="relative flex max-h-[min(90vh,760px)] w-full max-w-3xl flex-col rounded-2xl border border-[#e8e8ed] bg-white shadow-xl">
        <EcomDialogCloseButton disabled={busy} onClick={onClose} />
        <div className="border-b border-[#e8e8ed] px-5 py-4 pr-14">
          <h3 id="vton-model-pipeline-title" className="text-base font-semibold text-[#1d1d1f]">
            {panel === "models" ? "选择生图模型" : copy.title}
          </h3>
          <p className="mt-1 text-xs text-[#86868b]">
            {panel === "models" ? "选好后返回继续编辑参数与 Prompt。" : copy.hint}
          </p>
        </div>

        {panel === "form" ? (
          <>
            <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
                <span className="text-xs font-medium text-[#6e6e73]">出图精度</span>
                <VtonImageQualityPicker
                  value={imageSize}
                  onChange={setImageSize}
                  disabled={busy}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#6e6e73]">出图比例</p>
                <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] p-0.5">
                  {VTON_MODEL_PIPELINE_RATIO_OPTIONS.map((opt) => {
                    const active = ratio === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={busy}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                          active
                            ? "bg-white text-[#1d1d1f] shadow-sm"
                            : "text-[#6e6e73] hover:text-[#1d1d1f]",
                        )}
                        onClick={() => setRatio(opt.value)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2">
                <span className="text-xs text-[#6e6e73]">生图模型</span>
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={busy || showModelsLoading}
                  className="h-8 max-w-[min(100%,16rem)] truncate text-xs"
                  onClick={() => setPanel("models")}
                >
                  {showModelsLoading ? "加载模型…" : selectedModelName || "选择模型"}
                </EcomButtonSecondary>
              </div>

              {localLoadError && effectiveImageModels.length === 0 ? (
                <p className="rounded-lg border border-[#ffd6a5] bg-[#fff8ed] px-3 py-2 text-xs text-[#6e6e73]">
                  {localLoadError}
                  <button
                    type="button"
                    className="ml-2 text-[#0071e3]"
                    disabled={localLoading}
                    onClick={() => void refreshModels()}
                  >
                    重试
                  </button>
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium text-[#6e6e73]">年龄段</p>
                <div className="flex flex-wrap gap-1.5">
                  {VTON_MODEL_AGE_GROUP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                        ageGroup === opt.value
                          ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                          : "border-[#e8e8ed] text-[#6e6e73] hover:border-[#0071e3]/40",
                      )}
                      onClick={() => setAgeGroup(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#6e6e73]">体型预设</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {VTON_MODEL_BODY_PRESET_OPTIONS.map((opt) => {
                    const active = bodyPreset === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={busy}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left transition",
                          active
                            ? "border-[#0071e3] bg-[#f0f6ff]"
                            : "border-[#e8e8ed] bg-white hover:border-[#0071e3]/30",
                        )}
                        onClick={() => setBodyPreset(opt.value)}
                      >
                        <p className="text-[12px] font-medium text-[#1d1d1f]">{opt.label}</p>
                        <p className="text-[10px] text-[#86868b]">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#6e6e73]">
                  身材参考（可选 · 类似试衣间尺码）
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#86868b]">身高 cm</span>
                    <input
                      className={metricInputClass(busy)}
                      value={heightCm}
                      disabled={busy}
                      inputMode="decimal"
                      placeholder="170"
                      onChange={(e) => setHeightCm(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#86868b]">体重 kg</span>
                    <input
                      className={metricInputClass(busy)}
                      value={weightKg}
                      disabled={busy}
                      inputMode="decimal"
                      placeholder="55"
                      onChange={(e) => setWeightKg(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#86868b]">胸围 cm</span>
                    <input
                      className={metricInputClass(busy)}
                      value={bustCm}
                      disabled={busy}
                      inputMode="decimal"
                      onChange={(e) => setBustCm(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#86868b]">腰围 cm</span>
                    <input
                      className={metricInputClass(busy)}
                      value={waistCm}
                      disabled={busy}
                      inputMode="decimal"
                      onChange={(e) => setWaistCm(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#86868b]">臀围 cm</span>
                    <input
                      className={metricInputClass(busy)}
                      value={hipsCm}
                      disabled={busy}
                      inputMode="decimal"
                      onChange={(e) => setHipsCm(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-[#6e6e73]">
                  外貌细节（可选）
                </label>
                <input
                  className="w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  value={featureDetail}
                  disabled={busy}
                  placeholder="例如：眼角有泪痣、自然卷发…"
                  onChange={(e) => setFeatureDetail(e.target.value)}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#6e6e73]">{copy.promptLabel}</p>
                <textarea
                  className="ecom-scrollbar-thin min-h-[140px] w-full resize-y rounded-lg border border-[#e8e8ed] px-3 py-2.5 text-[13px] leading-relaxed text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15 disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
                  value={draftPrompt}
                  disabled={busy}
                  placeholder={
                    mode === "expand" ? "可选：补充姿态、背景、服装素模描述…" : undefined
                  }
                  onChange={(e) => setDraftPrompt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e8e8ed] px-5 py-4">
              <EcomGenerateCreditsBeside
                modelKey={draftModelKey}
                imageCount={1}
                enabled={open && Boolean(draftModelKey)}
              />
              <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onClose}>
                取消
              </EcomButtonSecondary>
              <EcomButtonPrimary
                type="button"
                size="sm"
                disabled={busy || !draftModelKey.trim() || (mode === "generate" && !draftPrompt.trim())}
                onClick={() => void onConfirm(mode, buildRequest())}
              >
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                {busy ? "提交中…" : copy.confirm}
              </EcomButtonPrimary>
            </div>
          </>
        ) : (
          <>
            <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
              {showModelsLoading ? (
                <p className="text-sm text-[#86868b]">正在加载 Gateway 生图模型…</p>
              ) : effectiveImageModels.length === 0 ? (
                <div className="space-y-3 text-sm text-[#86868b]">
                  <p>{localLoadError ?? "暂无可用 IMAGE 模型。"}</p>
                  <EcomButtonSecondary size="sm" type="button" onClick={() => void refreshModels()}>
                    重新加载模型
                  </EcomButtonSecondary>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {effectiveImageModels.map((m) => {
                    const active = m.modelKey === draftModelKey;
                    return (
                      <button
                        key={m.modelKey}
                        type="button"
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left transition",
                          active
                            ? "border-[#0071e3] bg-[#f0f6ff]"
                            : "border-[#e5e5ea] bg-white hover:border-[#0071e3]/40",
                        )}
                        onClick={() => {
                          setDraftModelKey(m.modelKey);
                          setPanel("form");
                        }}
                      >
                        <p className="text-sm font-medium text-[#1d1d1f]">{m.displayName}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#86868b]">{m.modelKey}</p>
                        {m.description ? (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6e6e73]">
                            {m.description}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-[#e8e8ed] px-5 py-4">
              <EcomButtonSecondary type="button" onClick={() => setPanel("form")}>
                返回
              </EcomButtonSecondary>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
