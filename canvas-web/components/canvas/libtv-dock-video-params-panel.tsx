"use client";

import type { CanvasParamSchema } from "@/lib/canvas-providers-api";
import { DynamicParamForm } from "@/components/canvas/dynamic-param-form";
import {
  LibtvDockAspectRatioGrid,
  LibtvDockBooleanSegmentRow,
  LibtvDockDurationSlider,
  LibtvDockParamSegmentRow,
} from "./libtv-dock-image-params-panel";

export function LibtvDockVideoParamsPanel({
  aspectLabel = "画布比例",
  aspectOptions,
  aspectValue,
  onAspectChange,
  resolutionLabel = "清晰度",
  resolutionOptions,
  resolutionValue,
  onResolutionChange,
  referenceModeLabel,
  referenceModeOptions,
  referenceModeValue,
  onReferenceModeChange,
  durationLabel,
  durationMin,
  durationMax,
  durationStep = 1,
  durationValue,
  onDurationChange,
  showDuration = true,
  showGenerateAudio = true,
  generateAudio,
  onGenerateAudioChange,
  showWatermark = false,
  watermark,
  onWatermarkChange,
  extraSchema,
  extraParams,
  onExtraParamsChange,
}: {
  aspectLabel?: string;
  aspectOptions: { id: string; label: string }[];
  aspectValue: string;
  onAspectChange: (id: string) => void;
  resolutionLabel?: string;
  resolutionOptions: { id: string; label: string }[];
  resolutionValue: string;
  onResolutionChange: (id: string) => void;
  referenceModeLabel?: string;
  referenceModeOptions?: { id: string; label: string }[];
  referenceModeValue?: string;
  onReferenceModeChange?: (id: string) => void;
  durationLabel?: string;
  durationMin: number;
  durationMax: number;
  durationStep?: number;
  durationValue: number;
  onDurationChange: (value: number) => void;
  showDuration?: boolean;
  showGenerateAudio?: boolean;
  generateAudio: boolean;
  onGenerateAudioChange: (value: boolean) => void;
  showWatermark?: boolean;
  watermark?: boolean;
  onWatermarkChange?: (value: boolean) => void;
  extraSchema?: CanvasParamSchema | null;
  extraParams?: Record<string, unknown>;
  onExtraParamsChange?: (next: Record<string, unknown>) => void;
}) {
  const aspectGridCols = aspectOptions.length <= 3 ? 3 : 5;

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl p-3">
      <LibtvDockAspectRatioGrid
        label={aspectLabel}
        options={aspectOptions}
        value={aspectValue}
        onChange={onAspectChange}
        columns={aspectGridCols}
      />

      <LibtvDockParamSegmentRow
        label={resolutionLabel}
        options={resolutionOptions}
        value={resolutionValue}
        onChange={onResolutionChange}
      />

      {referenceModeOptions &&
      referenceModeOptions.length > 0 &&
      referenceModeValue &&
      onReferenceModeChange ? (
        <LibtvDockParamSegmentRow
          label={referenceModeLabel ?? "参考模式"}
          options={referenceModeOptions}
          value={referenceModeValue}
          onChange={onReferenceModeChange}
        />
      ) : null}

      {showDuration ? (
        <LibtvDockDurationSlider
          label={durationLabel ?? "时长(秒)"}
          value={durationValue}
          min={durationMin}
          max={durationMax}
          step={durationStep}
          onChange={onDurationChange}
        />
      ) : null}

      {showGenerateAudio ? (
        <LibtvDockBooleanSegmentRow
          label="生成音频"
          value={generateAudio}
          onChange={onGenerateAudioChange}
          trueLabel="开启"
          falseLabel="关闭"
        />
      ) : null}

      {showWatermark && onWatermarkChange ? (
        <LibtvDockBooleanSegmentRow
          label="水印"
          value={Boolean(watermark)}
          onChange={onWatermarkChange}
          trueLabel="开启"
          falseLabel="关闭"
        />
      ) : null}

      {extraSchema?.length && extraParams && onExtraParamsChange ? (
        <div className="border-t border-white/5 pt-2">
          <DynamicParamForm
            variant="dock"
            schema={extraSchema}
            value={extraParams}
            onChange={onExtraParamsChange}
          />
        </div>
      ) : null}
    </div>
  );
}
