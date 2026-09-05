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
  Sbv1DockInputMode,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";
import {
  clampSbv1ReferenceMode,
  defaultSbv1DockInputModeForModel,
  dockInputModeToPatch,
  getSbv1VideoModelRefCaps,
  isSbv1Wan30VideoModel,
  resolveSbv1VideoModelRefLinkBlock,
} from "@/lib/canvas/sbv1-video-model-reference";
import { getSbv1VideoModelTypeLabels } from "@/lib/canvas/story-model-capabilities";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";
import {
  LIBTV_DOCK_MODEL_POPOVER_CLASS,
  LIBTV_DOCK_PARAMS_POPOVER_CLASS,
  LIBTV_DOCK_PICKER_CHECK_CLASS,
  libtvDockModelItemClassName,
} from "../libtv-dock-picker-chrome";
import { LibtvDockVideoParamsPanel } from "../libtv-dock-video-params-panel";
import {
  aspectOptionsFromVideoSchema,
  aspectValueFromParams,
  durationBoundsFromVideoSchema,
  filterDockVideoParamsSchema,
  resolutionOptionsFromVideoSchema,
  resolutionSegmentValue,
} from "@/lib/canvas/sbv1-video-dock-params-schema";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";
import {
  buildSbv1VideoEngineSettingsPatch,
  collectSbv1DockVideoModels,
} from "./sbv1-video-generate-settings-modal";
import {
  isSbv1MotionControlModelKey,
  normalizeSbv1EngineProviderId,
  sbv1VideoParamsTriggerLabel,
  syncSbv1UiFromModelParams,
} from "@/lib/canvas/sbv1-video-ui-sync";

const RESOLUTION_OPTIONS = [
  { id: "720p", label: "720P" },
  { id: "1080p", label: "1080P" },
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

export { sbv1VideoParamsTriggerLabel } from "@/lib/canvas/sbv1-video-ui-sync";

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
    const maxDur = isSbv1Wan30VideoModel(modelKey) ? 30 : 15;
    const fromParams = Number(engineParams.duration);
    if (Number.isFinite(fromParams) && fromParams >= 3 && fromParams <= maxDur) {
      return fromParams;
    }
    if (data.durationSec >= 3 && data.durationSec <= maxDur) return data.durationSec;
    return Math.min(15, maxDur);
  }, [smartMulti, engineParams.duration, data.durationSec, modelKey]);
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
    resolution?: Sbv1VideoEngineNodeData["resolution"];
    providerId?: string;
    modelKey?: string;
    engineParams?: Record<string, unknown>;
    generateAudio?: boolean;
    watermark?: boolean;
    dockInputMode?: Sbv1DockInputMode;
  },
) {
  const providerId = normalizeSbv1EngineProviderId(
    next.providerId ?? data.engine?.providerId,
  );
  const modelKey = (next.modelKey ?? data.engine?.modelKey ?? "").trim();
  if (!providerId || !modelKey) return;
  const engineParams = next.engineParams ?? data.engine?.params ?? {};
  const referenceMode = next.referenceMode ?? data.referenceMode;
  let aspectRatio = next.aspectRatio ?? data.aspectRatio;
  let durationSec = next.durationSec ?? data.durationSec;
  let resolution = next.resolution ?? data.resolution;
  if (next.engineParams !== undefined) {
    syncSbv1UiFromModelParams(modelKey, engineParams, {
      setAspectRatio: (v) => {
        aspectRatio = v;
      },
      setDurationSec: (v) => {
        durationSec = v;
      },
      setResolution: (v) => {
        resolution = v;
      },
      setGenerateAudio: () => {},
      setReferenceMode: () => {},
      providerId,
    });
  }
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
    const maxDur = isSbv1Wan30VideoModel(modelKey) ? 30 : 15;
    const fromParams = Number(engineParams.duration);
    if (Number.isFinite(fromParams) && fromParams >= 3 && fromParams <= maxDur) {
      effectiveDurationSec = fromParams;
    } else if (durationSec >= 3 && durationSec <= maxDur) {
      effectiveDurationSec = durationSec;
    } else {
      effectiveDurationSec = Math.min(15, maxDur);
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
      dockInputMode: next.dockInputMode ?? data.dockInputMode,
    }),
  );
}

export function Sbv1VideoDockModelPicker({
  data,
  disabled,
  onPatch,
  open: controlledOpen,
  onOpenChange,
  refLinkCount = 0,
}: {
  data: Sbv1VideoEngineNodeData;
  disabled?: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 已连接参考图数量 · 有图时禁用百炼 T2V */
  refLinkCount?: number;
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
    const defaultMode = defaultSbv1DockInputModeForModel(model.modelKey, {
      multiShots: p.multi_shots === true,
      providerId,
    });
    const modePatch = dockInputModeToPatch(defaultMode);
    patchVideoSettings(data, onPatch, {
      providerId,
      modelKey: model.modelKey,
      engineParams: p,
      referenceMode: modePatch.referenceMode,
      aspectRatio,
      durationSec,
      resolution,
      generateAudio,
      dockInputMode: modePatch.dockInputMode,
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
        className={LIBTV_DOCK_MODEL_POPOVER_CLASS}
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
            const typeLabels = getSbv1VideoModelTypeLabels(model.modelKey);
            const refBlock = resolveSbv1VideoModelRefLinkBlock({
              modelKey: model.modelKey,
              refLinkCount,
            });
            return (
              <button
                key={`${providerId}:${model.modelKey}`}
                type="button"
                disabled={refBlock.blocked}
                title={refBlock.reason}
                className={libtvDockModelItemClassName(selected, refBlock.blocked)}
                onClick={() => {
                  if (refBlock.blocked) return;
                  onSelect(providerId, model);
                }}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[10px] font-semibold text-white/70">
                  {displayName.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-white">
                      {displayName}
                    </span>
                    <span className="block truncate text-[10px] text-white/40">
                      {model.modelKey}
                    </span>
                  </span>
                  {typeLabels.length > 0 ? (
                    <span className="shrink-0 text-[10px] text-white/45">
                      {typeLabels.join(" · ")}
                    </span>
                  ) : null}
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
        estimatedHeight={520}
        className={LIBTV_DOCK_PARAMS_POPOVER_CLASS}
      >
        {derived.isMotionControl ? (
          <div className="space-y-2.5 px-3 pb-3 pt-2">
            <p className="text-[12px] leading-snug text-white/50">
              动作控制需连接参考图与驱动动作视频；其余参数随模型见下方。
            </p>
            {resolvedModel?.paramsSchema &&
            resolvedModel.paramsSchema.length > 0 ? (
              <DynamicParamForm
                variant="dock"
                schema={filterDockVideoParamsSchema(resolvedModel.paramsSchema)}
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
            ) : null}
          </div>
        ) : derived.isVolcDockModel ? (
          <LibtvDockVideoParamsPanel
            aspectOptions={SBV1_ASPECT_RATIOS.map((r) => ({
              id: r,
              label: sbv1AspectRatioLabel(r),
            }))}
            aspectValue={data.aspectRatio}
            onAspectChange={(id) =>
              patchVideoSettings(data, onPatch, {
                aspectRatio: id as Sbv1AspectRatio,
              })
            }
            resolutionOptions={RESOLUTION_OPTIONS.map((r) => ({
              id: r.id,
              label: r.label,
            }))}
            resolutionValue={data.resolution}
            onResolutionChange={(id) =>
              patchVideoSettings(data, onPatch, {
                resolution: id as "720p" | "1080p",
                engineParams: {
                  ...derived.engineParams,
                  resolution: id,
                },
              })
            }
            referenceModeOptions={SBV1_REFERENCE_MODES.map((m) => ({
              id: m.id,
              label: m.label,
            }))}
            referenceModeValue={data.referenceMode}
            onReferenceModeChange={(id) => {
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
            durationMin={4}
            durationMax={15}
            durationValue={derived.effectiveDurationSec}
            showDuration={!derived.smartMulti}
            onDurationChange={(next) =>
              patchVideoSettings(data, onPatch, {
                durationSec: next,
                engineParams: {
                  ...derived.engineParams,
                  duration: next,
                },
              })
            }
            generateAudio={derived.generateAudio}
            onGenerateAudioChange={(v) =>
              patchVideoSettings(data, onPatch, {
                generateAudio: v,
                engineParams: {
                  ...derived.engineParams,
                  generate_audio: v,
                  generateAudio: v,
                  sound: v,
                },
              })
            }
            showWatermark
            watermark={derived.watermark}
            onWatermarkChange={(v) =>
              patchVideoSettings(data, onPatch, {
                watermark: v,
                engineParams: {
                  ...derived.engineParams,
                  watermark: v,
                },
              })
            }
          />
        ) : (
          (() => {
            const schema = resolvedModel?.paramsSchema ?? null;
            const aspectOptions = aspectOptionsFromVideoSchema(schema);
            const resolutionOptions = resolutionOptionsFromVideoSchema(schema);
            const durationBounds = durationBoundsFromVideoSchema(schema);
            const extraSchema = filterDockVideoParamsSchema(schema);
            const aspectValue = aspectValueFromParams(
              derived.engineParams,
              data.aspectRatio,
            );
            const resolutionValue = resolutionSegmentValue(
              derived.engineParams.resolution ?? data.resolution,
              resolutionOptions,
              data.resolution,
            );
            return (
              <LibtvDockVideoParamsPanel
                aspectOptions={aspectOptions}
                aspectValue={aspectValue}
                onAspectChange={(id) =>
                  patchVideoSettings(data, onPatch, {
                    aspectRatio: id as Sbv1AspectRatio,
                    engineParams: {
                      ...derived.engineParams,
                      ratio: id,
                      aspect_ratio: id,
                    },
                  })
                }
                resolutionOptions={resolutionOptions}
                resolutionValue={resolutionValue}
                onResolutionChange={(id) =>
                  patchVideoSettings(data, onPatch, {
                    resolution:
                      id.toLowerCase() === "1080p" ||
                      id.toUpperCase() === "1080P"
                        ? "1080p"
                        : "720p",
                    engineParams: {
                      ...derived.engineParams,
                      resolution: id,
                    },
                  })
                }
                referenceModeOptions={
                  showGatewayReferenceMode
                    ? referenceModeOptions.map((m) => ({
                        id: m.id,
                        label: m.label,
                      }))
                    : undefined
                }
                referenceModeValue={
                  showGatewayReferenceMode ? data.referenceMode : undefined
                }
                onReferenceModeChange={
                  showGatewayReferenceMode
                    ? (id) =>
                        patchVideoSettings(data, onPatch, {
                          referenceMode: id as Sbv1ReferenceMode,
                        })
                    : undefined
                }
                durationMin={durationBounds.min}
                durationMax={durationBounds.max}
                durationStep={durationBounds.step}
                durationLabel={durationBounds.label}
                durationValue={derived.effectiveDurationSec}
                onDurationChange={(next) =>
                  patchVideoSettings(data, onPatch, {
                    durationSec: next,
                    engineParams: {
                      ...derived.engineParams,
                      duration: next,
                    },
                  })
                }
                generateAudio={derived.generateAudio}
                onGenerateAudioChange={(v) =>
                  patchVideoSettings(data, onPatch, {
                    generateAudio: v,
                    engineParams: {
                      ...derived.engineParams,
                      generate_audio: v,
                      generateAudio: v,
                      sound: v,
                    },
                  })
                }
                extraSchema={extraSchema}
                extraParams={derived.engineParams}
                onExtraParamsChange={(next) => {
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
            );
          })()
        )}
      </Sbv1ToolbarDropdown>
    </>
  );
}
