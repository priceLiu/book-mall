"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";

type Props = {
  onConfirm: () => void;
  onClose: () => void;
  confirming?: boolean;
  className?: string;
};

export function ImageExpandToolbar({
  onConfirm,
  onClose,
  confirming,
  className,
}: Props) {
  return (
    <div
      data-libtv-toolbar-interactive
      className={cn(
        "libtv-expand-toolbar nodrag nopan nowheel pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-md",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="关闭扩图"
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
      <span className="text-[11px] text-white/60">
        向外拖四角扩大画幅
      </span>
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
