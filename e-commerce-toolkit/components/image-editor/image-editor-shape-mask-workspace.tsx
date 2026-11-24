"use client";

import { Check, RotateCw, X } from "lucide-react";
import { useId, type PointerEvent as ReactPointerEvent } from "react";

import { ImageEditorFrameHandles } from "@/components/image-editor/image-editor-frame-handles";
import { getImageEditorShapeDef } from "@/lib/image-editor-shape-catalog";
import type { ImageEditorShapeMaskId } from "@/lib/image-editor-shape-catalog";
import { normalizeRotateDeg } from "@/lib/image-editor-transform";
import { cn } from "@/lib/utils";

type Props = {
  shapeMask: ImageEditorShapeMaskId;
  canvasWidth: number;
  canvasHeight: number;
  rotateDeg: number;
  lockAspect: boolean;
  crop: import("@/lib/image-editor-crop-rect").ImageEditorCropRect;
  naturalWidth: number;
  naturalHeight: number;
  sourceScale: number;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRotateDeg: (deg: number) => void;
  onCrop: (rect: import("@/lib/image-editor-crop-rect").ImageEditorCropRect) => void;
  onDragActiveChange?: (active: boolean) => void;
};

/** 形状外深色压暗（电商主题 ink），形内透明 — 保持原样式 */
export function ShapeMaskDimOverlay({ shapeMask }: { shapeMask: ImageEditorShapeMaskId }) {
  const uid = useId();
  const def = getImageEditorShapeDef(shapeMask);
  if (!def?.pathD) return null;
  const maskId = `ie-shape-dim-${uid.replace(/:/g, "")}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[15] h-full w-full overflow-hidden rounded-xl"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <path d={def.pathD} fill="black" />
        </mask>
      </defs>
      <rect width="100" height="100" fill="var(--ie-ink)" opacity="0.42" mask={`url(#${maskId})`} />
    </svg>
  );
}

function RuleOfThirdsGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[18] grid grid-cols-3 grid-rows-3 overflow-hidden rounded-xl"
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "border border-[var(--ie-cream)]/75",
            i % 3 !== 0 && "border-l-[var(--ie-cream)]/45",
            i >= 3 && "border-t-[var(--ie-cream)]/45",
          )}
        />
      ))}
    </div>
  );
}

export function ImageEditorShapeMaskChrome({
  shapeMask,
  canvasWidth,
  canvasHeight,
  rotateDeg,
  lockAspect,
  crop,
  naturalWidth,
  naturalHeight,
  sourceScale,
  disabled,
  onCancel,
  onConfirm,
  onRotateDeg,
  onCrop,
  onDragActiveChange,
}: Props) {
  const onRotateHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    const box = e.currentTarget.closest("[data-ie-crop-box]");
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = box.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRot = rotateDeg;

    const onMove = (ev: PointerEvent) => {
      const pointerAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const deltaDeg = ((pointerAngle - startPointerAngle) * 180) / Math.PI;
      onRotateDeg(normalizeRotateDeg(startRot + deltaDeg));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <>
      <div className="pointer-events-none absolute -top-12 left-1/2 z-[38] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-1.5 py-1 shadow-md">
        <button
          type="button"
          disabled={disabled}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          取消
        </button>
        <button
          type="button"
          disabled={disabled}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-[var(--ie-ink)] px-2.5 py-1 text-[11px] text-[var(--ie-cream)] hover:opacity-90 disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          确定
        </button>
      </div>

      <ShapeMaskDimOverlay shapeMask={shapeMask} />
      <RuleOfThirdsGrid />

      <div
        className="pointer-events-none absolute inset-0 z-[22] overflow-hidden rounded-xl ring-1 ring-[var(--ie-border)]/35"
        aria-hidden
      />

      <ImageEditorFrameHandles
        crop={crop}
        naturalWidth={naturalWidth}
        naturalHeight={naturalHeight}
        sourceScale={sourceScale}
        lockAspect={lockAspect}
        disabled={disabled}
        onCrop={onCrop}
        onDragActiveChange={onDragActiveChange}
      />

      <button
        type="button"
        disabled={disabled}
        title="按住拖动任意旋转"
        className="pointer-events-auto absolute -bottom-11 left-1/2 z-[40] flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-sm hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
        onPointerDown={onRotateHandleDown}
      >
        <RotateCw className="h-4 w-4" aria-hidden />
      </button>
    </>
  );
}