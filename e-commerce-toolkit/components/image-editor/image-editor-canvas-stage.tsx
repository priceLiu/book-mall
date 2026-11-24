"use client";

import { useMemo, type PointerEvent as ReactPointerEvent } from "react";

import { Check, RotateCw, Trash2, X } from "lucide-react";

import {
  ImageEditorFrameHandles,
  ImageEditorRectCropRuleGrid,
} from "@/components/image-editor/image-editor-frame-handles";
import { ImageEditorShapeMaskChrome } from "@/components/image-editor/image-editor-shape-mask-workspace";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import {
  computeCanvasSizeFromHandleDrag,
  frameScaleFromElement,
  type ImageEditorFrameResizeHandleId,
} from "@/lib/image-editor-frame-resize";
import { imageEditorStageSizeFromNatural } from "@/lib/image-editor-crop-overlay";
import {
  mapCropRectToStage,
  moveImageEditorCropRect,
  type ImageEditorCropRect,
} from "@/lib/image-editor-crop-rect";
import { normalizeRotateDeg } from "@/lib/image-editor-transform";
import type { ImageEditorShapeMaskId } from "@/lib/image-editor-types";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  ref?: React.Ref<HTMLDivElement>;
  tabIndex?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};

type Props = {
  imageUrl: string | null;
  displayUrl: string | null;
  baseDisplayUrl?: string | null;
  cropPreviewUrl?: string | null;
  cropDragging?: boolean;
  busy?: boolean;
  cropMode?: boolean;
  canvasCropInteract?: boolean;
  resizeInteract?: boolean;
  lockAspect?: boolean;
  shapeMask?: ImageEditorShapeMaskId;
  rotateDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
  filterStyle?: string;
  naturalWidth: number;
  naturalHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  cropRect?: ImageEditorCropRect | null;
  onCropRect?: (rect: ImageEditorCropRect) => void;
  fitInside?: boolean;
  pasteReady?: boolean;
  dragOver?: boolean;
  dropZoneProps?: DropZoneProps;
  onOpenFile?: () => void;
  onActivatePaste?: () => void;
  shapeMaskInteract?: boolean;
  onShapeMaskCancel?: () => void;
  onShapeMaskConfirm?: () => void;
  onShapeMaskRotateDeg?: (deg: number) => void;
  onCanvasResize?: (width: number, height: number) => void;
  onShapeMaskResize?: (width: number, height: number) => void;
  onCanvasDragActiveChange?: (active: boolean) => void;
  onClearImage?: () => void;
};

export function ImageEditorCanvasStage({
  imageUrl,
  displayUrl,
  baseDisplayUrl,
  cropPreviewUrl,
  cropDragging,
  busy,
  cropMode,
  canvasCropInteract,
  resizeInteract,
  lockAspect = true,
  shapeMask = "none",
  rotateDeg = 0,
  flipH = false,
  flipV = false,
  filterStyle,
  naturalWidth,
  naturalHeight,
  canvasWidth,
  canvasHeight,
  cropRect,
  onCropRect,
  fitInside = true,
  pasteReady,
  dragOver,
  dropZoneProps,
  onOpenFile,
  onActivatePaste,
  shapeMaskInteract,
  onShapeMaskCancel,
  onShapeMaskConfirm,
  onShapeMaskRotateDeg,
  onCanvasResize,
  onShapeMaskResize,
  onCanvasDragActiveChange,
  onClearImage,
}: Props) {
  const frameInteract = Boolean(shapeMaskInteract || canvasCropInteract);
  const empty = !imageUrl && !displayUrl;

  const viewportCap =
    typeof window !== "undefined" ? Math.min(900, window.innerHeight * 0.72) : 900;

  const stagePx = useMemo(() => {
    if (resizeInteract && canvasWidth > 0 && canvasHeight > 0) {
      return imageEditorStageSizeFromNatural(canvasWidth, canvasHeight, viewportCap);
    }
    if (frameInteract && naturalWidth > 0 && naturalHeight > 0) {
      return imageEditorStageSizeFromNatural(naturalWidth, naturalHeight, viewportCap);
    }
    const aspect =
      canvasWidth > 0 && canvasHeight > 0 ? canvasWidth / canvasHeight : 1;
    return { width: undefined as number | undefined, height: undefined as number | undefined, aspect };
  }, [
    canvasHeight,
    canvasWidth,
    frameInteract,
    naturalHeight,
    naturalWidth,
    resizeInteract,
    viewportCap,
  ]);

  const cropBox = useMemo(() => {
    if (!frameInteract || naturalWidth < 1 || !stagePx.width || !stagePx.height) return null;
    const rect =
      cropRect ??
      ({ x: 0, y: 0, w: naturalWidth, h: naturalHeight } satisfies ImageEditorCropRect);
    return mapCropRectToStage(rect, naturalWidth, naturalHeight, stagePx.width, stagePx.height);
  }, [cropRect, frameInteract, naturalHeight, naturalWidth, stagePx.height, stagePx.width]);

  const backdrop = baseDisplayUrl ?? displayUrl ?? imageUrl;
  const showCropResult = frameInteract && !cropDragging && Boolean(cropPreviewUrl);

  const onMoveCropDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropRect || !onCropRect || busy) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    onCanvasDragActiveChange?.(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...cropRect };
    const scale = cropBox?.scale && cropBox.scale > 0 ? cropBox.scale : 1;
    const pointerId = e.pointerId;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onCropRect(
        moveImageEditorCropRect(
          start,
          (ev.clientX - startX) / scale,
          (ev.clientY - startY) / scale,
          naturalWidth,
          naturalHeight,
        ),
      );
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onCanvasDragActiveChange?.(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  const onResizeHandleDown =
    (handle: ImageEditorFrameResizeHandleId) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!onCanvasResize || busy) return;
      e.preventDefault();
      e.stopPropagation();
      const frame = e.currentTarget.closest("[data-ie-shape-frame]");
      const { sx, sy } = frameScaleFromElement(frame, canvasWidth, canvasHeight);
      onCanvasDragActiveChange?.(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = canvasWidth;
      const startH = canvasHeight;
      const pointerId = e.pointerId;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const next = computeCanvasSizeFromHandleDrag(
          handle,
          startW,
          startH,
          (ev.clientX - startX) * sx,
          (ev.clientY - startY) * sy,
          lockAspect,
        );
        onCanvasResize(next.width, next.height);
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        onCanvasDragActiveChange?.(false);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
    };

  const onResizeRotateDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!onShapeMaskRotateDeg || busy) return;
    e.preventDefault();
    e.stopPropagation();
    const frame = e.currentTarget.closest("[data-ie-shape-frame]");
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRot = rotateDeg;
    const pointerId = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const pointerAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const deltaDeg = ((pointerAngle - startPointerAngle) * 180) / Math.PI;
      onShapeMaskRotateDeg(normalizeRotateDeg(startRot + deltaDeg));
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col bg-[var(--ie-cream-deep)] outline-none",
        dragOver && empty && "ring-2 ring-inset ring-[var(--ie-border)]/25",
      )}
      {...(empty ? dropZoneProps : { tabIndex: dropZoneProps?.tabIndex })}
      onPointerDown={empty || frameInteract ? undefined : onActivatePaste}
    >
      {backdrop && onClearImage ? (
        <button
          type="button"
          title="移除图片"
          className="absolute right-3 top-3 z-[60] inline-flex items-center gap-1.5 rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2.5 py-1.5 text-[11px] text-[var(--ie-muted)] shadow-md hover:border-[var(--ie-border)] hover:text-[var(--ie-ink)] lg:right-4 lg:top-4"
          onClick={(e) => {
            e.stopPropagation();
            onClearImage();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          移除图片
        </button>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        {backdrop && pasteReady ? (
          <p className="mb-2 text-[10px] text-[var(--ie-subtle)]">⌘V / Ctrl+V 粘贴图片 · 支持拖入文件</p>
        ) : null}

        {backdrop ? (
          <div
            className={cn(
              "relative flex w-full max-w-full items-center justify-center",
              (frameInteract || resizeInteract) && "pb-12 pt-14",
            )}
          >
            <div
              data-ie-shape-frame
              className={cn(
                "relative shrink-0 overflow-visible",
                resizeInteract
                  ? "bg-transparent"
                  : "rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm",
                cropMode && !shapeMaskInteract && !resizeInteract && "ring-2 ring-[var(--ie-border)]/20",
              )}
              style={
                (frameInteract || resizeInteract) && stagePx.width && stagePx.height
                  ? { width: stagePx.width, height: stagePx.height }
                  : {
                      aspectRatio: "aspect" in stagePx && stagePx.aspect ? `${stagePx.aspect}` : "1",
                      width: "100%",
                      maxHeight: "min(72vh, 900px)",
                    }
              }
            >
              {/* 底图固定：拖拽裁切框时不动 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resizeInteract ? (imageUrl ?? backdrop) : backdrop}
                alt="编辑底图"
                className={cn(
                  "absolute inset-0 h-full w-full",
                  resizeInteract ? "object-fill" : "object-contain",
                  showCropResult && "opacity-0",
                )}
                style={
                  resizeInteract
                    ? {
                        transform: `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                        filter: filterStyle,
                      }
                    : undefined
                }
                draggable={false}
              />

              {frameInteract && cropBox && stagePx.width && stagePx.height ? (
                <>
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-0 z-[20] bg-[var(--ie-ink)]/45"
                    style={{ height: cropBox.top }}
                  />
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 z-[20] bg-[var(--ie-ink)]/45"
                    style={{ top: cropBox.top + cropBox.height }}
                  />
                  <div
                    className="pointer-events-none absolute z-[20] bg-[var(--ie-ink)]/45"
                    style={{ top: cropBox.top, left: 0, width: cropBox.left, height: cropBox.height }}
                  />
                  <div
                    className="pointer-events-none absolute z-[20] bg-[var(--ie-ink)]/45"
                    style={{
                      top: cropBox.top,
                      left: cropBox.left + cropBox.width,
                      width: Math.max(0, stagePx.width - cropBox.left - cropBox.width),
                      height: cropBox.height,
                    }}
                  />
                </>
              ) : null}

              {frameInteract && cropBox ? (
                <div
                  data-ie-crop-box
                  className="absolute z-[30] overflow-visible rounded-lg ring-2 ring-[var(--ie-border)]/70"
                  style={{
                    left: cropBox.left,
                    top: cropBox.top,
                    width: cropBox.width,
                    height: cropBox.height,
                  }}
                >
                  {canvasCropInteract && onShapeMaskCancel && onShapeMaskConfirm ? (
                    <div className="pointer-events-none absolute -top-12 left-1/2 z-[40] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-1.5 py-1 shadow-md">
                      <button
                        type="button"
                        disabled={busy}
                        className="pointer-events-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShapeMaskCancel();
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-[var(--ie-ink)] px-2.5 py-1 text-[11px] text-[var(--ie-cream)] hover:opacity-90 disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShapeMaskConfirm();
                        }}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        确定
                      </button>
                    </div>
                  ) : null}
                  {canvasCropInteract ? <ImageEditorRectCropRuleGrid /> : null}
                  <div
                    className="absolute inset-0 z-[16] cursor-move"
                    onPointerDown={onMoveCropDown}
                  />

                  {showCropResult && cropPreviewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cropPreviewUrl}
                      alt="裁切预览"
                      className="pointer-events-none absolute inset-0 z-[12] h-full w-full rounded-lg object-fill"
                      draggable={false}
                    />
                  ) : null}

                  {shapeMaskInteract &&
                  shapeMask !== "none" &&
                  cropRect &&
                  onCropRect &&
                  onShapeMaskCancel &&
                  onShapeMaskConfirm &&
                  onShapeMaskRotateDeg ? (
                    <ImageEditorShapeMaskChrome
                      shapeMask={shapeMask}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      rotateDeg={rotateDeg}
                      lockAspect={lockAspect}
                      crop={cropRect}
                      naturalWidth={naturalWidth}
                      naturalHeight={naturalHeight}
                      sourceScale={cropBox.scale}
                      disabled={busy}
                      onCancel={onShapeMaskCancel}
                      onConfirm={onShapeMaskConfirm}
                      onRotateDeg={onShapeMaskRotateDeg}
                      onCrop={onCropRect}
                      onDragActiveChange={onCanvasDragActiveChange}
                    />
                  ) : null}

                  {canvasCropInteract && cropRect && onCropRect ? (
                    <ImageEditorFrameHandles
                      crop={cropRect}
                      naturalWidth={naturalWidth}
                      naturalHeight={naturalHeight}
                      sourceScale={cropBox.scale}
                      lockAspect={lockAspect}
                      disabled={busy}
                      onCrop={onCropRect}
                      onDragActiveChange={onCanvasDragActiveChange}
                    />
                  ) : null}
                </div>
              ) : resizeInteract ? (
                <div className="pointer-events-none absolute inset-0 z-[18]" aria-hidden>
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/75" />
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/75" />
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/75" />
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/75" />
                  <div className="absolute inset-0 border border-white/90" />
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayUrl ?? imageUrl ?? ""}
                    alt="编辑预览"
                    className={cn(
                      "absolute inset-0 h-full w-full",
                      fitInside ? "object-contain" : "object-cover",
                    )}
                    draggable={false}
                  />
                </>
              )}

              {resizeInteract && onShapeMaskCancel && onShapeMaskConfirm ? (
                <div className="pointer-events-none absolute -top-12 left-1/2 z-[40] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-1.5 py-1 shadow-md">
                  <button
                    type="button"
                    disabled={busy}
                    className="pointer-events-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShapeMaskCancel();
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-[var(--ie-ink)] px-2.5 py-1 text-[11px] text-[var(--ie-cream)] hover:opacity-90 disabled:opacity-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShapeMaskConfirm();
                    }}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    确定
                  </button>
                </div>
              ) : null}
              {resizeInteract && onShapeMaskRotateDeg ? (
                <button
                  type="button"
                  aria-label="旋转图片"
                  disabled={busy}
                  className="absolute bottom-0 left-1/2 z-[45] flex h-7 w-7 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-sm disabled:opacity-40"
                  onPointerDown={onResizeRotateDown}
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
              {resizeInteract && onCanvasResize ? (
                <div className="pointer-events-none absolute inset-0 z-[40]">
                  {(
                    [
                      ["nw", "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize"],
                      ["n", "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"],
                      ["ne", "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize"],
                      ["e", "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
                      ["se", "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize"],
                      ["s", "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize"],
                      ["sw", "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize"],
                      ["w", "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
                    ] as const
                  ).map(([id, pos]) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={`调整尺寸 ${id}`}
                      className={cn(
                        "pointer-events-auto absolute h-2.5 w-2.5 rounded-[2px] border border-[var(--ie-border)] bg-[var(--ie-cream)] shadow-sm",
                        pos,
                      )}
                      onPointerDown={onResizeHandleDown(id)}
                    />
                  ))}
                </div>
              ) : null}

              {busy ? <EcomMediaGeneratingBusy background="light" /> : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-10 py-14 text-center transition-colors",
              dragOver && "border-[var(--ie-border)]",
            )}
            {...dropZoneProps}
          >
            <button
              type="button"
              className="flex w-full flex-col items-center gap-3"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFile?.();
              }}
            >
              <span className="text-sm font-medium text-[var(--ie-ink)]">打开图片</span>
              <span className="text-[11px] leading-relaxed text-[var(--ie-subtle)]">
                支持本地上传、拖放，或 ⌘V / Ctrl+V 粘贴；也可从「添加」或「我的资产」导入
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}