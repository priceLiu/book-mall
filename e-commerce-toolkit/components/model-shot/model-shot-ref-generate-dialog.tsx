"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  listModelShotPropPresets,
  listModelShotScenePresets,
  propPresetToImagePrompt,
  scenePresetToImagePrompt,
  type ModelShotPropPreset,
  type ModelShotScenePreset,
} from "@/lib/model-shot-prompt-presets";
import { fetchModelShotModels } from "@/lib/ecom-model-shot-api";
import type { ModelShotReferenceRole } from "@/lib/model-shot-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const FALLBACK_SCENE = {
  id: "default",
  name: "极简高调影棚",
  visualPrompt: "纯白无缝背景纸，均匀柔和顶光侧光，干净无杂物，专业商业摄影棚质感",
};

const FALLBACK_PROP = {
  id: "default",
  name: "黑色极简手提包",
  visualDescription: "简约无logo，硬挺皮革材质，金属扣件，哑光质感，中号托特包型",
};

export const MODEL_SHOT_REF_GEN_DEFAULT_PROMPTS: Record<
  Exclude<ModelShotReferenceRole, "garment">,
  string
> = {
  model:
    "全身时尚女模特，自然妆容与发型，中性灰摄影棚背景，电商 lookbook 全身照，柔和均匀光，高清无水印",
  scene: scenePresetToImagePrompt(listModelShotScenePresets()[0] ?? FALLBACK_SCENE),
  prop: propPresetToImagePrompt(listModelShotPropPresets()[0] ?? FALLBACK_PROP),
};

const ROLE_TITLE: Record<Exclude<ModelShotReferenceRole, "garment">, string> = {
  model: "AI 生成模特参考",
  scene: "AI 生成场景参考",
  prop: "AI 生成道具参考",
};

const ROLE_HINT: Record<Exclude<ModelShotReferenceRole, "garment">, string> = {
  model: "纯文生图生成模特参考，不传入服装图；最终出图时再与服装参考合成。",
  scene: "从内置场景词库切换提示词，再生成空场景参考图。",
  prop: "从内置道具词库切换提示词，再生成道具参考图。",
};

type Props = {
  open: boolean;
  onClose: () => void;
  role: Exclude<ModelShotReferenceRole, "garment">;
  modelKey: string;
  modelDisplayName: string;
  imageModels: StoryboardGatewayModel[];
  modelsLoading?: boolean;
  modelsEmptyHint?: string;
  onRetryLoadModels?: () => void | Promise<void>;
  busy?: boolean;
  onConfirm: (opts: { prompt: string; modelKey: string }) => void | Promise<void>;
};

type Panel = "form" | "models";

function PresetPicker({
  role,
  selectedId,
  onSelect,
  disabled,
}: {
  role: "scene" | "prop";
  selectedId: string | null;
  onSelect: (preset: ModelShotScenePreset | ModelShotPropPreset) => void;
  disabled?: boolean;
}) {
  const presets = useMemo(
    () => (role === "scene" ? listModelShotScenePresets() : listModelShotPropPresets()),
    [role],
  );

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs font-medium text-[#6e6e73]">
        内置{role === "scene" ? "场景" : "道具"}词库 · 点击切换提示词
      </p>
      <div className="ecom-scrollbar-thin max-h-[28vh] space-y-1.5 overflow-y-auto rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-2">
        {presets.map((preset) => {
          const active = preset.id === selectedId;
          const desc =
            role === "scene"
              ? (preset as ModelShotScenePreset).visualPrompt
              : (preset as ModelShotPropPreset).visualDescription;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left transition",
                active
                  ? "border-[#0071e3] bg-[#f0f6ff]"
                  : "border-transparent bg-white hover:border-[#0071e3]/30",
              )}
              onClick={() => onSelect(preset)}
            >
              <p className="text-[13px] font-medium text-[#1d1d1f]">{preset.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#6e6e73]">
                {desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModelShotRefGenerateDialog({
  open,
  onClose,
  role,
  modelKey,
  modelDisplayName,
  imageModels,
  modelsLoading = false,
  modelsEmptyHint,
  onRetryLoadModels,
  busy,
  onConfirm,
}: Props) {
  const scenePresets = useMemo(() => listModelShotScenePresets(), []);
  const propPresets = useMemo(() => listModelShotPropPresets(), []);
  const initialPresetId =
    role === "scene" ? scenePresets[0]?.id : role === "prop" ? propPresets[0]?.id : null;

  const defaultPrompt = MODEL_SHOT_REF_GEN_DEFAULT_PROMPTS[role];
  const [draft, setDraft] = useState(defaultPrompt);
  const [panel, setPanel] = useState<Panel>("form");
  const [draftModelKey, setDraftModelKey] = useState(modelKey);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(initialPresetId);
  const [localImageModels, setLocalImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localLoadError, setLocalLoadError] = useState<string | null>(null);

  const effectiveImageModels =
    imageModels.length > 0 ? imageModels : localImageModels;
  const showModelsLoading =
    (modelsLoading || localLoading) && effectiveImageModels.length === 0;

  const refreshModels = useCallback(async () => {
    setLocalLoading(true);
    setLocalLoadError(null);
    try {
      if (onRetryLoadModels) {
        await onRetryLoadModels();
      }
      const payload = await fetchModelShotModels();
      setLocalImageModels(payload.imageModels);
      if (payload.imageModels.length === 0) {
        setLocalLoadError(
          modelsEmptyHint ??
            "Gateway 未返回可用生图模型，请检查凭证或平台 IMAGE 模型上架。",
        );
      }
    } catch (e) {
      setLocalLoadError(e instanceof Error ? e.message : "模型列表加载失败");
    } finally {
      setLocalLoading(false);
    }
  }, [modelsEmptyHint, onRetryLoadModels]);

  useEffect(() => {
    if (!open) return;
    setDraft(defaultPrompt);
    setDraftModelKey(modelKey);
    setPanel("form");
    setSelectedPresetId(initialPresetId);
    setLocalLoadError(null);
  }, [open, defaultPrompt, modelKey, initialPresetId]);

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
          : modelKey || effectiveImageModels[0]!.modelKey,
      ),
    );
  }, [effectiveImageModels, modelKey]);

  if (!open || typeof document === "undefined") return null;

  const selectedName =
    effectiveImageModels.find((m) => m.modelKey === draftModelKey)?.displayName ??
    modelDisplayName ??
    draftModelKey;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-shot-ref-gen-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <EcomDialogCloseButton disabled={busy} onClick={onClose} />
        <div className="border-b border-[#e5e5ea] px-5 py-4 pr-14">
          <h3 id="model-shot-ref-gen-title" className="text-base font-semibold text-[#1d1d1f]">
            {panel === "models" ? "选择生图模型" : ROLE_TITLE[role]}
          </h3>
          <p className="mt-1 text-xs text-[#86868b]">
            {panel === "models"
              ? "选好后返回继续编辑 Prompt。"
              : ROLE_HINT[role]}
          </p>
        </div>

        {panel === "form" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2">
                <span className="text-xs text-[#6e6e73]">生图模型</span>
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={busy || showModelsLoading}
                  className="h-8 max-w-[min(100%,16rem)] truncate text-xs"
                  onClick={() => setPanel("models")}
                >
                  {showModelsLoading ? "加载模型…" : selectedName || "选择模型"}
                </EcomButtonSecondary>
              </div>

              {localLoadError && effectiveImageModels.length === 0 ? (
                <p className="mb-4 rounded-lg border border-[#ffd6a5] bg-[#fff8ed] px-3 py-2 text-xs text-[#6e6e73]">
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

              {role === "scene" ? (
                <PresetPicker
                  role="scene"
                  selectedId={selectedPresetId}
                  disabled={busy}
                  onSelect={(preset) => {
                    const p = preset as ModelShotScenePreset;
                    setSelectedPresetId(p.id);
                    setDraft(scenePresetToImagePrompt(p));
                  }}
                />
              ) : null}

              {role === "prop" ? (
                <PresetPicker
                  role="prop"
                  selectedId={selectedPresetId}
                  disabled={busy}
                  onSelect={(preset) => {
                    const p = preset as ModelShotPropPreset;
                    setSelectedPresetId(p.id);
                    setDraft(propPresetToImagePrompt(p));
                  }}
                />
              ) : null}

              <p className="mb-2 text-xs font-medium text-[#6e6e73]">生图 Prompt（可微调）</p>
              <textarea
                className="min-h-[20vh] w-full resize-y rounded-lg border border-[#e8e8ed] px-3 py-2.5 text-[13px] leading-relaxed text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15 disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
                value={draft}
                autoFocus={role === "model"}
                disabled={busy}
                placeholder="描述期望的模特/场景/道具画面…"
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <div className="flex justify-end border-t border-[#e5e5ea] px-5 py-4">
              <EcomButtonPrimary
                type="button"
                disabled={busy || !draft.trim() || !draftModelKey.trim()}
                onClick={() => void onConfirm({ prompt: draft.trim(), modelKey: draftModelKey })}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {busy ? "生成中…" : "生成"}
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
            <div className="flex justify-end border-t border-[#e5e5ea] px-5 py-4">
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
