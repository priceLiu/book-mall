"use client";

import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { LibtvExpandAspectRatio } from "@/lib/canvas/libtv-expand-session";
import { LibtvDockCreditsLabel } from "@/components/canvas/libtv-dock-credits-label";
import { LibtvDockSendButton } from "@/components/canvas/libtv-dock-send-button";
import { Pro2DockToolbar } from "@/components/canvas/pro2/pro2-input-dock-shell";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { SBV1_IMAGE_RESOLUTIONS } from "@/lib/canvas/sbv1-image-models";

const ASPECT_OPTIONS: { value: LibtvExpandAspectRatio; label: string }[] = [
  { value: "original", label: "原图比例" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const COUNT_OPTIONS = [1, 2, 4] as const;

type Props = {
  aspectRatio: LibtvExpandAspectRatio;
  resolution: string;
  outputCount: number;
  credits?: number | null;
  creditsTitle?: string;
  running?: boolean;
  canSubmit?: boolean;
  onAspectRatioChange: (v: LibtvExpandAspectRatio) => void;
  onResolutionChange: (v: string) => void;
  onOutputCountChange: (v: number) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function DockSelect({
  value,
  label,
  options,
  onChange,
  disabled,
}: {
  value: string;
  label: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
  return (
    <label
      className={cn(
        "nodrag relative flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06]",
        disabled && "pointer-events-none opacity-40",
      )}
      style={{ fontSize: fontPx, minHeight: minHeightPx }}
    >
      <span className="whitespace-nowrap">{label}</span>
      <ChevronDown
        className="shrink-0 opacity-45"
        style={{ width: chevronPx, height: chevronPx }}
      />
      <select
        value={value}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ImageExpandDockBar({
  aspectRatio,
  resolution,
  outputCount,
  credits,
  creditsTitle,
  running,
  canSubmit,
  onAspectRatioChange,
  onResolutionChange,
  onOutputCountChange,
  onClose,
  onSubmit,
}: Props) {
  const { fontPx, minHeightPx } = useLibtvDockToolbarMetrics();
  const aspectLabel =
    ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.label ?? "原图比例";

  return (
    <Pro2DockToolbar className="w-full min-w-0 gap-1 overflow-x-auto">
      <button
        type="button"
        title="关闭扩图"
        className={cn(
          "nodrag flex shrink-0 items-center justify-center rounded-md px-2 text-white/70 hover:bg-white/[0.06]",
          RF_NO_DRAG,
          RF_NO_WHEEL,
        )}
        style={{ minHeight: minHeightPx, fontSize: fontPx }}
        onClick={onClose}
      >
        <X className="size-4" />
      </button>
      <div className="mx-0.5 h-5 w-px bg-white/12" />
      <DockSelect
        value={aspectRatio}
        label={aspectLabel}
        disabled={running}
        options={ASPECT_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
        }))}
        onChange={(v) => onAspectRatioChange(v as LibtvExpandAspectRatio)}
      />
      <DockSelect
        value={resolution}
        label={SBV1_IMAGE_RESOLUTIONS.find((r) => r.value === resolution)?.label ?? resolution}
        disabled={running}
        options={SBV1_IMAGE_RESOLUTIONS.map((r) => ({
          value: r.value,
          label: r.label,
        }))}
        onChange={onResolutionChange}
      />
      <DockSelect
        value={String(outputCount)}
        label={`${outputCount}张`}
        disabled={running}
        options={COUNT_OPTIONS.map((n) => ({
          value: String(n),
          label: `${n}张`,
        }))}
        onChange={(v) => onOutputCountChange(Number(v) || 1)}
      />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <LibtvDockCreditsLabel credits={credits} fontPx={fontPx} title={creditsTitle} />
        <LibtvDockSendButton
          disabled={!canSubmit}
          loading={running}
          title="扩图"
          onClick={onSubmit}
        />
      </div>
    </Pro2DockToolbar>
  );
}
