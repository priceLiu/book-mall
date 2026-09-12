"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { LibtvCropAspectRatio } from "@/lib/canvas/libtv-crop-session";
import type { LibtvExpandAspectRatio } from "@/lib/canvas/libtv-expand-session";
import { LibtvDockCreditsLabel } from "@/components/canvas/libtv-dock-credits-label";
import { LibtvDockSendButton } from "@/components/canvas/libtv-dock-send-button";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { SBV1_IMAGE_RESOLUTIONS } from "@/lib/canvas/sbv1-image-models";

const EXPAND_ASPECT_OPTIONS: { value: LibtvExpandAspectRatio; label: string }[] =
  [
    { value: "original", label: "原图比例" },
    { value: "1:1", label: "1:1" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
  ];

const CROP_ASPECT_OPTIONS: { value: LibtvCropAspectRatio; label: string }[] = [
  { value: "original", label: "原图比例" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const COUNT_OPTIONS = [1, 2, 4] as const;

function FrameDockShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-libtv-toolbar-interactive
      className={cn(
        "nodrag nopan nowheel flex w-max max-w-full items-center gap-0 rounded-xl",
        "bg-[#262626] px-1.5 py-1 shadow-lg backdrop-blur-sm",
        RF_NO_DRAG,
        RF_NO_WHEEL,
      )}
    >
      {children}
    </div>
  );
}

function FrameDockSelect({
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
        "relative flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-1 text-white/90 hover:bg-white/[0.06]",
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

function FrameDockCloseButton({ title, onClick }: { title: string; onClick: () => void }) {
  const { fontPx, minHeightPx } = useLibtvDockToolbarMetrics();
  return (
    <button
      type="button"
      title={title}
      className="flex shrink-0 items-center justify-center rounded-md px-1.5 text-white/65 hover:bg-white/[0.06]"
      style={{ minHeight: minHeightPx, fontSize: fontPx }}
      onClick={onClick}
    >
      <X className="size-3.5" />
    </button>
  );
}

function FrameDockDivider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-white/10" />;
}

type ExpandProps = {
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

export function ImageExpandFrameDock({
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
}: ExpandProps) {
  const { fontPx } = useLibtvDockToolbarMetrics();
  const aspectLabel =
    EXPAND_ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.label ?? "原图比例";

  return (
    <FrameDockShell>
      <FrameDockCloseButton title="关闭扩图" onClick={onClose} />
      <FrameDockDivider />
      <FrameDockSelect
        value={aspectRatio}
        label={aspectLabel}
        disabled={running}
        options={EXPAND_ASPECT_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
        }))}
        onChange={(v) => onAspectRatioChange(v as LibtvExpandAspectRatio)}
      />
      <FrameDockSelect
        value={resolution}
        label={
          SBV1_IMAGE_RESOLUTIONS.find((r) => r.value === resolution)?.label ??
          resolution
        }
        disabled={running}
        options={SBV1_IMAGE_RESOLUTIONS.map((r) => ({
          value: r.value,
          label: r.label,
        }))}
        onChange={onResolutionChange}
      />
      <FrameDockSelect
        value={String(outputCount)}
        label={`${outputCount}张`}
        disabled={running}
        options={COUNT_OPTIONS.map((n) => ({
          value: String(n),
          label: `${n}张`,
        }))}
        onChange={(v) => onOutputCountChange(Number(v) || 1)}
      />
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
        <LibtvDockCreditsLabel credits={credits} fontPx={fontPx} title={creditsTitle} />
        <LibtvDockSendButton
          disabled={!canSubmit}
          loading={running}
          title="扩图"
          onClick={onSubmit}
        />
      </div>
    </FrameDockShell>
  );
}

type CropProps = {
  aspectRatio: LibtvCropAspectRatio;
  confirming?: boolean;
  onAspectRatioChange: (v: LibtvCropAspectRatio) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function ImageCropFrameDock({
  aspectRatio,
  confirming,
  onAspectRatioChange,
  onClose,
  onConfirm,
}: CropProps) {
  const { fontPx, minHeightPx } = useLibtvDockToolbarMetrics();
  const aspectLabel =
    CROP_ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.label ?? "原图比例";

  return (
    <FrameDockShell>
      <FrameDockCloseButton title="关闭裁剪" onClick={onClose} />
      <FrameDockDivider />
      <FrameDockSelect
        value={aspectRatio}
        label={aspectLabel}
        disabled={confirming}
        options={CROP_ASPECT_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
        }))}
        onChange={(v) => onAspectRatioChange(v as LibtvCropAspectRatio)}
      />
      <div className="ml-auto flex shrink-0 items-center pl-2">
        <button
          type="button"
          disabled={confirming}
          onClick={onConfirm}
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-white px-2 font-medium text-black hover:bg-white/90 disabled:opacity-50",
          )}
          style={{ fontSize: fontPx, minHeight: minHeightPx }}
        >
          <Check className="size-3.5" />
          确认
        </button>
      </div>
    </FrameDockShell>
  );
}
