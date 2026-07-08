"use client";

import { useMemo } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  SBV1_IMAGE_ASPECT_RATIOS,
  SBV1_IMAGE_MODEL_KEYS,
  SBV1_IMAGE_OUTPUT_COUNTS,
  SBV1_IMAGE_RESOLUTIONS,
  buildSbv1ImageEngineParams,
  sbv1ImageAspectRatioLabel,
  type Sbv1ImageAspectRatio,
  type Sbv1ImageQuality,
  type Sbv1ImageResolution,
} from "@/lib/canvas/sbv1-image-models";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { resolveLibtvDockEngineModelDisplayName } from "@/lib/canvas/libtv-dock-engine-models";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";
import {
  LIBTV_DOCK_POPOVER_CLASS,
  LibtvDockParamGrid,
} from "../libtv-dock-picker-chrome";
import { LibtvDockEngineModelPicker } from "../libtv-dock-engine-model-picker";

const QUALITY_OPTIONS: { id: Sbv1ImageQuality; label: string }[] = [
  { id: "low", label: "低" },
  { id: "standard", label: "标准" },
  { id: "high", label: "高" },
];

const FORMAT_OPTIONS = ["png", "jpeg", "webp"] as const;
type OutputFormat = (typeof FORMAT_OPTIONS)[number];

function readOutputFormat(params: Record<string, unknown>): OutputFormat {
  const fmt = String(params.output_format ?? "png").toLowerCase();
  return FORMAT_OPTIONS.includes(fmt as OutputFormat)
    ? (fmt as OutputFormat)
    : "png";
}

export function buildSbv1ImageEngineSettingsPatch(input: {
  imageQuality: Sbv1ImageQuality;
  resolution: Sbv1ImageResolution;
  aspectRatio: Sbv1ImageAspectRatio;
  outputCount: number;
  outputFormat: OutputFormat;
  providerId: string;
  modelKey: string;
  engineParams: Record<string, unknown>;
}): Partial<Sbv1ImageNodeData> {
  const params = buildSbv1ImageEngineParams({
    aspectRatio: input.aspectRatio,
    imageQuality: input.imageQuality,
    resolution: input.resolution,
    outputCount: input.outputCount,
  });
  params.output_format = input.outputFormat;
  return {
    imageQuality: input.imageQuality,
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
    outputCount: input.outputCount,
    engine: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      params: { ...input.engineParams, ...params },
    },
  };
}

function patchImageSettings(
  data: Sbv1ImageNodeData,
  onPatch: (patch: Partial<Sbv1ImageNodeData>) => void,
  next: Partial<{
    imageQuality: Sbv1ImageQuality;
    resolution: Sbv1ImageResolution;
    aspectRatio: Sbv1ImageAspectRatio;
    outputCount: number;
    outputFormat: OutputFormat;
    providerId: string;
    modelKey: string;
    engineParams: Record<string, unknown>;
  }>,
) {
  const providerId = (next.providerId ?? data.engine?.providerId ?? "").trim();
  const modelKey = (next.modelKey ?? data.engine?.modelKey ?? "").trim();
  if (!providerId || !modelKey) return;
  const engineParams = next.engineParams ?? data.engine?.params ?? {};
  onPatch(
    buildSbv1ImageEngineSettingsPatch({
      imageQuality: next.imageQuality ?? data.imageQuality ?? "standard",
      resolution: next.resolution ?? data.resolution ?? "2K",
      aspectRatio: next.aspectRatio ?? data.aspectRatio ?? "auto",
      outputCount: next.outputCount ?? data.outputCount ?? 1,
      outputFormat:
        next.outputFormat ?? readOutputFormat(engineParams),
      providerId,
      modelKey,
      engineParams,
    }),
  );
}

/** Dock 底栏 · 模型触发钮文案 */
export function sbv1ImageModelTriggerLabel(
  data: Sbv1ImageNodeData,
  providers: CanvasProviderDto[],
): string {
  const engineKey = data.engine?.modelKey?.trim();
  if (!engineKey) return "选择模型";
  return resolveLibtvDockEngineModelDisplayName(engineKey, providers);
}

/** Dock 底栏 · 参数触发钮文案 */
export function sbv1ImageParamsTriggerLabel(data: Sbv1ImageNodeData): string {
  if (!data.engine?.modelKey?.trim()) return "参数";
  const quality =
    QUALITY_OPTIONS.find((q) => q.id === (data.imageQuality ?? "standard"))
      ?.label ?? "标准";
  const resolution = data.resolution ?? "2K";
  const aspect = sbv1ImageAspectRatioLabel(data.aspectRatio ?? "auto");
  const count = data.outputCount ?? 1;
  const format = readOutputFormat(data.engine?.params ?? {});
  return [aspect, resolution, quality, `${count}张`, format].join(" · ");
}

/** @deprecated 使用 sbv1ImageModelTriggerLabel + sbv1ImageParamsTriggerLabel */
export function sbv1ImageSettingsTriggerLabel(
  data: Sbv1ImageNodeData,
  providers: CanvasProviderDto[],
): string {
  return sbv1ImageModelTriggerLabel(data, providers);
}

export function Sbv1ImageDockModelPicker({
  data,
  allowedModelKeys,
  disabled,
  onPatch,
  open,
  onOpenChange,
}: {
  data: Sbv1ImageNodeData;
  allowedModelKeys?: readonly string[];
  disabled?: boolean;
  onPatch: (patch: Partial<Sbv1ImageNodeData>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { providers } = useUserProviders();

  return (
    <LibtvDockEngineModelPicker
      role="IMAGE"
      providerId={data.engine?.providerId ?? ""}
      modelKey={data.engine?.modelKey ?? ""}
      allowedModelKeys={allowedModelKeys ?? [...SBV1_IMAGE_MODEL_KEYS]}
      externalProviders={providers}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      onSelect={({ providerId, modelKey }) => {
        patchImageSettings(data, onPatch, { providerId, modelKey });
      }}
    />
  );
}

export function Sbv1ImageDockParamsPicker({
  data,
  disabled,
  onPatch,
  open,
  onOpenChange,
}: {
  data: Sbv1ImageNodeData;
  disabled?: boolean;
  onPatch: (patch: Partial<Sbv1ImageNodeData>) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(open);
  const effectiveOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
  const hasModel = Boolean(data.engine?.modelKey?.trim());
  const label = sbv1ImageParamsTriggerLabel(data);
  const outputFormat = useMemo(
    () => readOutputFormat(data.engine?.params ?? {}),
    [data.engine?.params],
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled || !hasModel}
        title={hasModel ? label : "请先选择模型"}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!effectiveOpen)}
      >
        <SlidersHorizontal className="size-3.5 shrink-0 text-white/55" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={effectiveOpen && hasModel}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={360}
        className={LIBTV_DOCK_POPOVER_CLASS}
      >
        <div className="space-y-3 pb-1">
          <LibtvDockParamGrid
            label="画质"
            options={QUALITY_OPTIONS.map((q) => ({ id: q.id, label: q.label }))}
            value={data.imageQuality ?? "standard"}
            onChange={(id) =>
              patchImageSettings(data, onPatch, {
                imageQuality: id as Sbv1ImageQuality,
              })
            }
          />
          <LibtvDockParamGrid
            label="清晰度"
            options={SBV1_IMAGE_RESOLUTIONS.map((r) => ({
              id: r.value,
              label: r.label,
            }))}
            value={data.resolution ?? "2K"}
            onChange={(id) =>
              patchImageSettings(data, onPatch, {
                resolution: id as Sbv1ImageResolution,
              })
            }
          />
          <LibtvDockParamGrid
            label="比例"
            options={SBV1_IMAGE_ASPECT_RATIOS.map((r) => ({
              id: r.value,
              label: sbv1ImageAspectRatioLabel(r.value),
            }))}
            value={data.aspectRatio ?? "auto"}
            onChange={(id) =>
              patchImageSettings(data, onPatch, {
                aspectRatio: id as Sbv1ImageAspectRatio,
              })
            }
          />
          <LibtvDockParamGrid
            label="张数"
            options={SBV1_IMAGE_OUTPUT_COUNTS.map((n) => ({
              id: String(n),
              label: String(n),
            }))}
            value={String(data.outputCount ?? 1)}
            onChange={(id) =>
              patchImageSettings(data, onPatch, {
                outputCount: Number(id) || 1,
              })
            }
          />
          <LibtvDockParamGrid
            label="格式"
            options={FORMAT_OPTIONS.map((f) => ({ id: f, label: f }))}
            value={outputFormat}
            onChange={(id) =>
              patchImageSettings(data, onPatch, {
                outputFormat: id as OutputFormat,
              })
            }
          />
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
