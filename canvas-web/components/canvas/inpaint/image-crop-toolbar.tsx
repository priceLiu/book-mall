"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { LibtvCropAspectRatio } from "@/lib/canvas/libtv-crop-session";

const ASPECT_OPTIONS: { value: LibtvCropAspectRatio; label: string }[] = [
  { value: "original", label: "原图比例" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

type Props = {
  aspectRatio: LibtvCropAspectRatio;
  onAspectRatioChange: (ratio: LibtvCropAspectRatio) => void;
  onConfirm: () => void;
  onClose: () => void;
  confirming?: boolean;
  className?: string;
};

export function ImageCropToolbar({
  aspectRatio,
  onAspectRatioChange,
  onConfirm,
  onClose,
  confirming,
  className,
}: Props) {
  return (
    <div
      data-libtv-toolbar-interactive
      className={cn(
        "libtv-crop-toolbar nodrag nopan nowheel pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-md",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="关闭裁剪"
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/70 hover:bg-white/10",
          RF_NO_DRAG,
          RF_NO_WHEEL,
          "nopan",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="size-4" />
      </button>
      <div className="mx-1 h-5 w-px bg-white/15" />
      <select
        value={aspectRatio}
        onChange={(e) =>
          onAspectRatioChange(e.target.value as LibtvCropAspectRatio)
        }
        className="nodrag max-w-[120px] rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/85"
        title="裁剪比例"
      >
        {ASPECT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={confirming}
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
        className={cn(
          "ml-1 rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-white/90 disabled:opacity-50",
          RF_NO_DRAG,
          "nopan",
        )}
      >
        <span className="inline-flex items-center gap-1">
          <Check className="size-3.5" />
          确认
        </span>
      </button>
    </div>
  );
}
