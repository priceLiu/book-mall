"use client";

import { useMemo } from "react";
import { Check, ChevronDown, SlidersHorizontal, Sparkles } from "lucide-react";
import { DynamicParamForm } from "@/components/canvas/dynamic-param-form";
import { hideKieVendorLabel } from "@/lib/canvas/gateway-model-role";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "@/lib/canvas/system-providers";
import type { CanvasProviderModelDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import {
  SBV1_ASPECT_RATIOS,
  SBV1_REFERENCE_MODES,
  sbv1AspectRatioLabel,
} from "@/lib/canvas/sbv1-video-models";
import type {
  Sbv1AspectRatio,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";
import {
  clampSbv1ReferenceMode,
  getSbv1VideoModelRefCaps,
} from "@/lib/canvas/sbv1-video-model-reference";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";
import {
  LIBTV_DOCK_POPOVER_CLASS,
  LibtvDockParamGrid,
  LIBTV_DOCK_PICKER_CHECK_CLASS,
  libtvDockModelItemClassName,
} from "../libtv-dock-picker-chrome";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";
import {
  buildSbv1VideoEngineSettingsPatch,
  collectSbv1DockVideoModels,
  isSbv1MotionControlModelKey,
  normalizeSbv1EngineProviderId,
  syncSbv1UiFromModelParams,
} from "./sbv1-video-generate-settings-modal";

const RESOLUTION_OPTIONS = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
] as const;

function resolveVideoModelDisplayName(
  modelKey: string,
  providers: ReturnType<typeof useUserProviders>["providers"],
): string {
  for (const p of providers) {
    const gw = p.models.find(
      (m) => m.modelKey.toLowerCase() === modelKey.toLowerCase(),
    );
    if (gw?.displayName) return hideKieVendorLabel(gw.displayName);
  }
  return hideKieVendorLabel(modelKey);
}

/** Dock 底栏 · 模型触发钮文案 */
export function sbv1VideoModelTriggerLabel(
  data: Sbv1VideoEngineNodeData,
  providers: ReturnType<typeof useUserProviders>["providers"],
): string {
  const engineKey = data.engine?.modelKey?.trim();
  if (!engineKey) return "选择模型";
  return resolveVideoModelDisplayName(engineKey, providers);
}

/** Dock 底栏 · 参数触发钮文案 */
export function sbv1VideoParamsTriggerLabel(data: Sbv1VideoEngineNodeData): string {
  if (!data.engine?.modelKey?.trim()) return "参数";
  const parts: string[] = [sbv1AspectRatioLabel(data.aspectRatio)];
  if (data.resolution) parts.push(data.resolution.toUpperCase());
  if (data.referenceMode === "smart_multi") {
    parts.push("智能多帧");
  } else if (data.durationSec >= 4 && data.durationSec <= 15) {
    parts.push(`${data.durationSec}s`);
  }
  return parts.join(" · ");
}

function useSbv1VideoSettingsDerived(data: Sbv1VideoEngineNodeData) {
  const providerId = normalizeSbv1EngineProviderId(data.engine?.providerId);
  const modelKey = data.engine?.modelKey ?? "";
  const engineParams = data.engine?.params ?? {};
  const isMotionControl = isSbv1MotionControlModelKey(modelKey);
  const isVolcDockModel =
    providerId === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID && !isMotionControl;
  const smartMulti = data.referenceMode === "smart_multi" && isVolcDockModel;
  const klingMultiShots = engineParams.multi_shots === true;
  const refCaps = useMemo(
    () =>
      getSbv1VideoModelRefCaps(modelKey, {
        multiShots: klingMultiShots,
        providerId,
      }),
    [modelKey, klingMultiShots, providerId],
  );
  const effectiveDurationSec = useMemo(() => {
    if (smartMulti) return 0;
    const fromParams = Number(engineParams.duration);
    if (Number.isFinite(fromParams) && fromParams >= 4 && fromParams <= 15) {
      return fromParams;
    }
    if (data.durationSec >= 4 && data.durationSec <= 15) return data.durationSec;
    return 15;
  }, [smartMulti, engineParams.duration, data.durationSec]);
  const generateAudio = engineParams.generate_audio !== false;
  const watermark = Boolean(engineParams.watermark);
  return {
    providerId,
    modelKey,
    engineParams,
    isMotionControl,
    isVolcDockModel,
    smartMulti,
    refCaps,
    effectiveDurationSec,
    generateAudio,
    watermark,
  };
}

function patchVideoSettings(
  data: Sbv1VideoEngineNodeData,
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void,
  next: {
    referenceMode?: Sbv1ReferenceMode;
    aspectRatio?: Sbv1AspectRatio;
    durationSec?: number;
    resolution?: "720p" | "1080p";
    providerId?: string;
    modelKey?: string;
    engineParams?: Record<string, unknown>;
    generateAudio?: boolean;
    watermark?: boolean;
  },
) {
  const providerId = normalizeSbv1EngineProviderId(
    next.providerId ?? data.engine?.providerId,
  );
  const modelKey = (next.modelKey ?? data.engine?.modelKey ?? "").trim();
  if (!providerId || !modelKey) return;
  const engineParams = next.engineParams ?? data.engine?.params ?? {};
  const referenceMode = next.referenceMode ?? data.referenceMode;
  const aspectRatio = next.aspectRatio ?? data.aspectRatio;
  const durationSec = next.durationSec ?? data.durationSec;
  const resolution = next.resolution ?? data.resolution;
  const generateAudio =
    next.generateAudio ?? engineParams.generate_audio !== false;
  const watermark = next.watermark ?? Boolean(engineParams.watermark);
  const isMotionControl = isSbv1MotionControlModelKey(modelKey);
  const isVolcDockModel =
    providerId === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID && !isMotionControl;
  const smartMulti = referenceMode === "smart_multi" && isVolcDockModel;
  const refCaps = getSbv1VideoModelRefCaps(modelKey, {
    multiShots: engineParams.multi_shots === true,
    providerId,
  });
  let effectiveDurationSec = durationSec;
  if (smartMulti) {
    effectiveDurationSec = 0;
  } else {
    const fromParams = Number(engineParams.duration);
    if (Number.isFinite(fromParams) && fromParams >= 4 && fromParams <= 15) {
      effectiveDurationSec = fromParams;
    } else if (durationSec >= 4 && durationSec <= 15) {
      effectiveDurationSec = durationSec;
    } else {
      effectiveDurationSec = 15;
    }
  }
  onPatch(
    buildSbv1VideoEngineSettingsPatch({
      referenceMode,
      aspectRatio,
      durationSec,
      resolution,
      providerId,
      modelKey,
      engineParams,
      generateAudio,
      watermark,
      effectiveDurationSec,
      isVolcDockModel,
      smartMulti,
      refCapsMultiShotsBlocksFirstLast: refCaps.multiShotsBlocksFirstLast,
    }),
  );
}

export function Sbv1VideoDockModelPicker({
  data,
  disabled,
  onPatch,
  open: controlledOpen,
  onOpenChange,
}: {
  data: Sbv1VideoEngineNodeData;
  disabled?: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { providers } = useUserProviders();
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
  const models = useMemo(
    () => collectSbv1DockVideoModels(providers),
    [providers],
  );
  const label = sbv1VideoModelTriggerLabel(data, providers);
  const selectedKey = data.engine?.modelKey?.trim() ?? "";
  const selectedProvider = normalizeSbv1EngineProviderId(data.engine?.providerId);

  const onSelect = (providerId: string, model: CanvasProviderModelDto) => {
    const p = { ...(data.engine?.params ?? {}) };
    let referenceMode = data.referenceMode;
    let aspectRatio = data.aspectRatio;
    let durationSec = data.durationSec;
    let resolution = data.resolution;
    let generateAudio = p.generate_audio !== false;
    syncSbv1UiFromModelParams(model.modelKey, p, {
      setAspectRatio: (v) => {
        aspectRatio = v;
      },
      setDurationSec: (v) => {
        durationSec = v;
      },
      setResolution: (v) => {
        resolution = v;
      },
      setGenerateAudio: (v) => {
        generateAudio = v;
      },
      setReferenceMode: (v) => {
        referenceMode = v;
      },
      providerId,
      currentReferenceMode: data.referenceMode,
    });
    const caps = getSbv1VideoModelRefCaps(model.modelKey, {
      multiShots: p.multi_shots === true,
      providerId,
    });
    referenceMode = clampSbv1ReferenceMode(referenceMode, caps);
    patchVideoSettings(data, onPatch, {
      providerId,
      modelKey: model.modelKey,
      engineParams: p,
      referenceMode,
      aspectRatio,
      durationSec,
      resolution,
      generateAudio,
    });
    setOpen(false);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        title={label}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="size-3.5 shrink-0 text-white/55" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={280}
        className={LIBTV_DOCK_POPOVER_CLASS}
      >
        <p className="px-3 pb-1.5 pt-0.5 text-[13px] font-medium text-white/75">
          选择模型
        </p>
        <div className="space-y-0.5 px-1.5">
          {models.map(({ providerId, model }) => {
            const selected =
              selectedProvider === providerId &&
              selectedKey === model.modelKey;
            const displayName = hideKieVendorLabel(
              model.displayName || model.modelKey,
            );
            return (
              <button
                key={`${providerId}:${model.modelKey}`}
                type="button"
                className={libtvDockModelItemClassName(selected)}
                onClick={() => onSelect(providerId, model)}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[10px] font-semibold text-white/70">
                  {displayName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-white">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10px] text-white/40">
                    {model.modelKey}
                  </span>
                </span>
                {selected ? (
                  <Check className={LIBTV_DOCK_PICKER_CHECK_CLASS} />
                ) : null}
              </button>
            );
          })}
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}

export function Sbv1VideoDockParamsPicker({
  data,
  disabled,
  onPatch,
  open: controlledOpen,
  onOpenChange,
}: {
  data: Sbv1VideoEngineNodeData;
  disabled?: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { providers } = useUserProviders();
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
  const derived = useSbv1VideoSettingsDerived(data);
  const label = sbv1VideoParamsTriggerLabel(data);
  const hasModel = Boolean(data.engine?.modelKey?.trim());
  const referenceModeOptions = SBV1_REFERENCE_MODES.filter((m) =>
    derived.refCaps.supportedModes.includes(m.id),
  );
  const showGatewayReferenceMode =
    !derived.isMotionControl &&
    !derived.isVolcDockModel &&
    referenceModeOptions.length > 1;
  const resolvedModel = useMemo(() => {
    if (!derived.providerId || !derived.modelKey) return null;
    for (const p of providers) {
      if (p.id !== derived.providerId) continue;
      return p.models.find((m) => m.modelKey === derived.modelKey) ?? null;
    }
    return null;
  }, [providers, derived.providerId, derived.modelKey]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled || !hasModel}
        title={hasModel ? label : "请先选择模型"}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal className="size-3.5 shrink-0 text-white/55" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={open && hasModel}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={360}
        className={LIBTV_DOCK_POPOVER_CLASS}
      >
        <div className="space-y-3 pb-1">
          {derived.isVolcDockModel ? (
            <>
              <LibtvDockParamGrid
                label="比例"
                options={SBV1_ASPECT_RATIOS.map((r) => ({
                  id: r,
                  label: sbv1AspectRatioLabel(r),
                }))}
                value={data.aspectRatio}
                onChange={(id) =>
                  patchVideoSettings(data, onPatch, {
                    aspectRatio: id as Sbv1AspectRatio,
                  })
                }
              />
              <LibtvDockParamGrid
                label="分辨率"
                options={RESOLUTION_OPTIONS.map((r) => ({
                  id: r.id,
                  label: r.label,
                }))}
                value={data.resolution}
                onChange={(id) =>
                  patchVideoSettings(data, onPatch, {
                    resolution: id as "720p" | "1080p",
                    engineParams: {
                      ...derived.engineParams,
                      resolution: id,
                    },
                  })
                }
              />
              <LibtvDockParamGrid
                label="参考模式"
                options={SBV1_REFERENCE_MODES.map((m) => ({
                  id: m.id,
                  label: m.label,
                }))}
                value={data.referenceMode}
                onChange={(id) => {
                  const mode = id as Sbv1ReferenceMode;
                  const nextDuration =
                    mode === "smart_multi"
                      ? 0
                      : data.durationSec < 4 || data.durationSec > 15
                        ? 15
                        : data.durationSec;
                  patchVideoSettings(data, onPatch, {
                    referenceMode: mode,
                    durationSec: nextDuration,
                  });
                }}
              />
              {!derived.smartMulti ? (
                <div className="px-3">
                  <div className="mb-1.5 flex items-center justify-between text-[12px] text-white/50">
                    <span>时长</span>
                    <span className="tabular-nums text-white/75">
                      {derived.effectiveDurationSec}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={15}
                    step={1}
                    value={derived.effectiveDurationSec}
                    className="nodrag h-1.5 w-full cursor-pointer accent-white"
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      patchVideoSettings(data, onPatch, {
                        durationSec: next,
                        engineParams: {
                          ...derived.engineParams,
                          duration: next,
                        },
                      });
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {showGatewayReferenceMode ? (
                <LibtvDockParamGrid
                  label="参考模式"
                  options={referenceModeOptions.map((m) => ({
                    id: m.id,
                    label: m.label,
                  }))}
                  value={data.referenceMode}
                  onChange={(id) =>
                    patchVideoSettings(data, onPatch, {
                      referenceMode: id as Sbv1ReferenceMode,
                    })
                  }
                />
              ) : null}
              {resolvedModel?.paramsSchema &&
              resolvedModel.paramsSchema.length > 0 ? (
                <div className="px-3">
                  <DynamicParamForm
                    variant="panel"
                    schema={resolvedModel.paramsSchema}
                    value={derived.engineParams}
                    onChange={(next) => {
                      let referenceMode = data.referenceMode;
                      if (
                        derived.refCaps.multiShotsBlocksFirstLast &&
                        next.multi_shots === true
                      ) {
                        referenceMode = "omni";
                      }
                      patchVideoSettings(data, onPatch, {
                        engineParams: next,
                        referenceMode,
                      });
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
