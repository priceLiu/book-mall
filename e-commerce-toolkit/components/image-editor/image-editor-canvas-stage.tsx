"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { Check, Hand, Hash, Layers, Minus, Plus, RotateCw, SquareSplitHorizontal, Trash2, X } from "lucide-react";

import {
  ImageEditorFrameHandles,
  ImageEditorRectCropRuleGrid,
  imageEditorFrameHandleClass,
} from "@/components/image-editor/image-editor-frame-handles";
import { ImageEditorShapeMaskChrome, ShapeMaskDimOverlay } from "@/components/image-editor/image-editor-shape-mask-workspace";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import {
  computeCanvasSizeFromHandleDrag,
  frameScaleFromElement,
  placeImageInCanvas,
  type ImageEditorFrameResizeHandleId,
} from "@/lib/image-editor-frame-resize";
import {
  mapCropRectToStage,
  moveImageEditorCropRect,
  type ImageEditorCropRect,
} from "@/lib/image-editor-crop-rect";
import { normalizeRotateDeg } from "@/lib/image-editor-transform";
import { ImageEditorTextOverlay } from "@/components/image-editor/image-editor-text-overlay";
import { IMAGE_EDITOR_TEXT_PLACEHOLDER, type ImageEditorTextLayerExtras } from "@/lib/image-editor-text";
import type { ImageEditorShapeMaskId } from "@/lib/image-editor-types";
import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";
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
  correctionInteract?: boolean;
  lockAspect?: boolean;
  shapeMask?: ImageEditorShapeMaskId;
  rotateDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
  filterStyle?: string;
  correctionCss?: string;
  /** 按住对比时显示的原图。和当前图不同才切换。 */
  compareUrl?: string | null;
  naturalWidth: number;
  naturalHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  cropRect?: ImageEditorCropRect | null;
  onCropRect?: (rect: ImageEditorCropRect) => void;
  fitInside?: boolean;
  frameOffsetX?: number;
  frameOffsetY?: number;
  onFrameOffset?: (x: number, y: number) => void;
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
  textInteract?: boolean;
  textOverlay?: EcomCopyOverlay;
  textExtras?: Record<string, ImageEditorTextLayerExtras>;
  selectedTextLayerId?: string | null;
  editingTextLayerId?: string | null;
  onSelectTextLayer?: (id: string | null, extra?: { additive?: boolean }) => void;
  selectedTextLayerIds?: string[];
  onEditTextLayer?: (id: string | null) => void;
  onTextLayerPatch?: (id: string, patch: Partial<EcomCopyOverlayLayer>) => void;
  onTextExtrasPatch?: (id: string, patch: Partial<ImageEditorTextLayerExtras>) => void;
  onTextContent?: (id: string, text: string) => void;
  onTextDuplicate?: (id: string) => void;
  onTextDelete?: (id: string) => void;
  onTextCopyStyle?: (id: string) => void;
  onTextAiFlower?: (id: string) => void;
  eraseOverlay?: ReactNode;
};

type LayerPanelRow = {
  key: string;
  label: string;
  selectId: string | null;
  active: boolean;
  imageSrc?: string;
  color?: string;
  bg?: string;
};

function layerPieceLabel(layer: EcomCopyOverlayLayer, extras?: ImageEditorTextLayerExtras): string {
  const text = layer.text.trim();
  const named = text && text !== IMAGE_EDITOR_TEXT_PLACEHOLDER ? text : "";
  if (extras?.posterSrc) return named || "图片";
  if (extras?.role === "decor") return named || "装饰";
  return named || text || "文字";
}

function buildLayerPanelRows(
  layers: EcomCopyOverlayLayer[],
  extras: Record<string, ImageEditorTextLayerExtras>,
  selectedIds: string[],
  baseSrc: string | null,
): LayerPanelRow[] {
  const selected = new Set(selectedIds);
  const seen = new Set<string>();
  const rows: LayerPanelRow[] = [];
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];
    if (!layer || seen.has(layer.id)) continue;
    const extra = extras[layer.id];
    const grouped = Boolean(extra?.groupId) && extra?.grouped !== false;
    if (grouped && extra?.groupId) {
      const members = layers.filter((item) => {
        const itemExtra = extras[item.id];
        return itemExtra?.groupId === extra.groupId && itemExtra.grouped !== false;
      });
      for (const member of members) seen.add(member.id);
      const labelLayer =
        members.find((item) => extras[item.id]?.role === "label" && item.text.trim()) ??
        members.find((item) => item.text.trim() && item.text.trim() !== IMAGE_EDITOR_TEXT_PLACEHOLDER && !extras[item.id]?.posterSrc) ??
        members[0];
      const poster = [...members].reverse().find((item) => extras[item.id]?.posterSrc);
      if (!labelLayer) continue;
      rows.push({
        key: extra.groupId,
        label: layerPieceLabel(labelLayer, extras[labelLayer.id]),
        selectId: labelLayer.id,
        active: members.some((item) => selected.has(item.id)),
        imageSrc: poster ? extras[poster.id]?.posterSrc : undefined,
        color: labelLayer.color,
        bg: labelLayer.textBgEnabled ? labelLayer.textBgColor : undefined,
      });
      continue;
    }
    seen.add(layer.id);
    rows.push({
      key: layer.id,
      label: layerPieceLabel(layer, extra),
      selectId: layer.id,
      active: selected.has(layer.id),
      imageSrc: extra?.posterSrc,
      color: layer.color,
      bg: layer.textBgEnabled ? layer.textBgColor : undefined,
    });
  }
  if (baseSrc) {
    rows.push({
      key: "base-image",
      label: "主图",
      selectId: null,
      active: selectedIds.length === 0,
      imageSrc: baseSrc,
    });
  }
  return rows;
}

const ZOOM_PRESETS = [400, 300, 200, 175, 150, 125, 100, 75, 50, 25, 15] as const;

function composeFrameImageStyle(base: string, correction?: string, filter?: string) {
  const transform = [base, correction].filter(Boolean).join(" ");
  if (!transform && !filter) return undefined;
  return {
    transform: transform || undefined,
    transformOrigin: "center center",
    filter: filter || undefined,
  };
}

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
  correctionInteract,
  lockAspect = true,
  shapeMask = "none",
  rotateDeg = 0,
  flipH = false,
  flipV = false,
  filterStyle,
  correctionCss,
  compareUrl,
  naturalWidth,
  naturalHeight,
  canvasWidth,
  canvasHeight,
  cropRect,
  onCropRect,
  fitInside = true,
  frameOffsetX = 0,
  frameOffsetY = 0,
  onFrameOffset,
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
  textInteract,
  textOverlay,
  textExtras,
  selectedTextLayerId,
  selectedTextLayerIds,
  editingTextLayerId,
  onSelectTextLayer,
  onEditTextLayer,
  onTextLayerPatch,
  onTextExtrasPatch,
  onTextContent,
  onTextDuplicate,
  onTextDelete,
  onTextCopyStyle,
  onTextAiFlower,
  eraseOverlay,
}: Props) {
  const frameInteract = Boolean(shapeMaskInteract || canvasCropInteract);
  const empty = !imageUrl && !displayUrl;
  const [zoom, setZoom] = useState(100);
  const [showRulers, setShowRulers] = useState(false);
  const [guides, setGuides] = useState<Array<{ id: number; axis: "h" | "v"; pos: number }>>([]);
  const [guideMenu, setGuideMenu] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareHint, setCompareHint] = useState(false);
  const [zoomMenu, setZoomMenu] = useState(false);
  const [zoomHint, setZoomHint] = useState(false);
  const [layerPanel, setLayerPanel] = useState(false);
  const [layerHint, setLayerHint] = useState(false);
  const [hand, setHand] = useState(false);
  const [panning, setPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomBoxRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const guideSeq = useRef(1);
  const compareTimer = useRef<number | null>(null);
  const liveCorrection = comparing ? "" : correctionCss;

  const clearCompareTimer = () => {
    if (compareTimer.current != null) {
      window.clearTimeout(compareTimer.current);
      compareTimer.current = null;
    }
  };

  const startCompare = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    clearCompareTimer();
    setComparing(true);
  };

  const endCompare = (e: ReactPointerEvent<HTMLButtonElement>) => {
    clearCompareTimer();
    setComparing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    if (!correctionInteract) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setShowRulers((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [correctionInteract]);

  useEffect(() => () => clearCompareTimer(), []);

  const addGuide = (axis: "h" | "v") => {
    const id = guideSeq.current++;
    setGuides((list) => {
      const same = list.filter((g) => g.axis === axis).length;
      const pos = Math.min(86, Math.max(14, 50 + ((same % 5) - 2) * 10));
      return [...list, { id, axis, pos }];
    });
    setGuideMenu(false);
  };

  const onGuideDown = (id: number, axis: "h" | "v") => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const frame = e.currentTarget.closest("[data-ie-shape-frame]");
    if (!frame) return;
    const pointerId = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const rect = frame.getBoundingClientRect();
      const pos =
        axis === "h"
          ? ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 100
          : ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const next = Math.min(98, Math.max(2, pos));
      setGuides((list) => list.map((g) => (g.id === id ? { ...g, pos: next } : g)));
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", end);
  };

  const frameRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const [measuredFrame, setMeasuredFrame] = useState({ w: 0, h: 0 });
  const [wellBox, setWellBox] = useState({ w: 0, h: 0 });
  /** 记为 100% 的中间可用宽度。侧栏收起后宽度变了，显示比例跟着变。 */
  const [fitAvail, setFitAvail] = useState(0);
  const savedShownRef = useRef<number | null>(null);

  const stageAspect =
    resizeInteract && naturalWidth > 0 && naturalHeight > 0
      ? naturalWidth / naturalHeight
      : frameInteract && naturalWidth > 0 && naturalHeight > 0
        ? naturalWidth / naturalHeight
        : canvasWidth > 0 && canvasHeight > 0
          ? canvasWidth / canvasHeight
          : 1;

  useEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setWellBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      setMeasuredFrame((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty, stageAspect, zoom]);

  const frameLayout = useMemo(() => {
    const padX = 48;
    const availW = Math.max(1, wellBox.w - padX);
    const width = Math.max(1, Math.round(availW * (zoom / 100)));
    const height = Math.max(1, Math.round(width / stageAspect));
    const shownZoom =
      fitAvail > 0 ? Math.max(1, Math.round((zoom * availW) / fitAvail)) : Math.round(zoom);
    return { width, height, availW, shownZoom };
  }, [fitAvail, stageAspect, wellBox.w, zoom]);

  useEffect(() => {
    if (wellBox.w > 48 && fitAvail === 0) setFitAvail(wellBox.w - 48);
  }, [fitAvail, wellBox.w]);

  const stepShownZoom = (delta: number) => {
    setZoom((z) => {
      const avail = Math.max(1, wellBox.w - 48);
      const base = fitAvail > 0 ? fitAvail : avail;
      const shown = Math.round((z * avail) / base);
      const next = Math.min(400, Math.max(15, shown + delta));
      return (next * base) / avail;
    });
  };

  useEffect(() => {
    if (!zoomMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!zoomBoxRef.current?.contains(e.target as Node)) setZoomMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [zoomMenu]);

  const applyShownZoom = (shown: number) => {
    const avail = Math.max(1, wellBox.w - 48);
    const base = fitAvail > 0 ? fitAvail : avail;
    setZoom((Math.min(400, Math.max(15, shown)) * base) / avail);
  };

  const fitToScreen = () => {
    const padX = 48;
    const tallChrome = frameInteract || resizeInteract || correctionInteract;
    const padY = tallChrome ? 136 : 88;
    const availW = Math.max(1, wellBox.w - padX);
    const availH = Math.max(1, wellBox.h - padY);
    const aspect = stageAspect > 0 ? stageAspect : 1;
    const fitW = Math.min(availW, availH * aspect);
    const base = fitAvail > 0 ? fitAvail : availW;
    applyShownZoom((fitW / base) * 100);
    setZoomMenu(false);
  };

  const canvasSizeLabel =
    canvasWidth > 0 && canvasHeight > 0
      ? `${Math.round(canvasWidth)} x ${Math.round(canvasHeight)}px`
      : naturalWidth > 0 && naturalHeight > 0
        ? `${Math.round(naturalWidth)} x ${Math.round(naturalHeight)}px`
        : "";

  const stagePx = useMemo(() => {
    if (measuredFrame.w < 8 || measuredFrame.h < 8) {
      return { width: undefined as number | undefined, height: undefined as number | undefined, aspect: stageAspect };
    }
    return { width: measuredFrame.w, height: measuredFrame.h, aspect: stageAspect };
  }, [measuredFrame.h, measuredFrame.w, stageAspect]);

  const cropBox = useMemo(() => {
    if (!frameInteract || naturalWidth < 1 || !stagePx.width || !stagePx.height) return null;
    const rect =
      cropRect ??
      ({ x: 0, y: 0, w: naturalWidth, h: naturalHeight } satisfies ImageEditorCropRect);
    return mapCropRectToStage(rect, naturalWidth, naturalHeight, stagePx.width, stagePx.height);
  }, [cropRect, frameInteract, naturalHeight, naturalWidth, stagePx.height, stagePx.width]);

  const resizePlace = useMemo(() => {
    if (!resizeInteract || naturalWidth < 1 || naturalHeight < 1 || canvasWidth < 1 || canvasHeight < 1) {
      return null;
    }
    return placeImageInCanvas({
      canvasW: canvasWidth,
      canvasH: canvasHeight,
      imageW: naturalWidth,
      imageH: naturalHeight,
      fitInside,
      offsetX: frameOffsetX,
      offsetY: frameOffsetY,
    });
  }, [
    canvasHeight,
    canvasWidth,
    fitInside,
    frameOffsetX,
    frameOffsetY,
    naturalHeight,
    naturalWidth,
    resizeInteract,
  ]);

  const resizeFrameBox = useMemo(() => {
    if (!resizePlace || frameLayout.width < 1 || resizePlace.w < 1) return null;
    const scale = frameLayout.width / resizePlace.w;
    return {
      left: -resizePlace.x * scale,
      top: -resizePlace.y * scale,
      width: canvasWidth * scale,
      height: canvasHeight * scale,
    };
  }, [canvasHeight, canvasWidth, frameLayout.width, resizePlace]);

  const backdrop = baseDisplayUrl ?? displayUrl ?? imageUrl;
  const heldOriginal = comparing && compareUrl ? compareUrl : null;
  const showCropResult = frameInteract && !cropDragging && Boolean(cropPreviewUrl);

  const layerRows = useMemo(() => {
    const selected = selectedTextLayerIds?.length
      ? selectedTextLayerIds
      : selectedTextLayerId
        ? [selectedTextLayerId]
        : [];
    return buildLayerPanelRows(textOverlay?.layers ?? [], textExtras ?? {}, selected, imageUrl ?? backdrop);
  }, [backdrop, imageUrl, selectedTextLayerId, selectedTextLayerIds, textExtras, textOverlay?.layers]);
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

  const onMoveResizeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onFrameOffset || busy) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    const frame = e.currentTarget.closest("[data-ie-shape-frame]");
    const { sx, sy } = frameScaleFromElement(frame, canvasWidth, canvasHeight);
    onCanvasDragActiveChange?.(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = frameOffsetX;
    const originY = frameOffsetY;
    const pointerId = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onFrameOffset(originX - (ev.clientX - startX) * sx, originY - (ev.clientY - startY) * sy);
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

  const onPanDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hand) return;
    event.preventDefault();
    panDragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag) return;
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
  };

  const onPanUp = () => {
    panDragRef.current = null;
    setPanning(false);
  };

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-[var(--ie-cream-deep)] outline-none",
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

      <div className={cn("relative min-h-0 min-w-0 flex-1", empty && "flex items-center justify-center p-6")}>
        {backdrop && pasteReady ? (
          <p className="pointer-events-none absolute left-0 right-0 top-2 z-[5] text-center text-[10px] text-[var(--ie-subtle)]">⌘V / Ctrl+V 粘贴图片 · 支持拖入文件</p>
        ) : null}

        {backdrop ? (
          <>
          <div
            ref={wellRef}
            className="ecom-scrollbar-thin absolute inset-0 overflow-auto [scrollbar-gutter:stable]"
          >
            <div
              className={cn(
                "flex min-h-full w-max min-w-full items-center justify-center px-6 pb-16 pt-6",
                (frameInteract || resizeInteract || correctionInteract) && "pb-20 pt-14",
              )}
              style={pan.x || pan.y ? { transform: `translate(${pan.x}px, ${pan.y}px)` } : undefined}
            >
            <div
              className="relative shrink-0"
              style={{ width: frameLayout.width, height: frameLayout.height }}
            >
            {resizeInteract ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heldOriginal ?? imageUrl ?? backdrop ?? ""}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  style={composeFrameImageStyle(
                    `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                    liveCorrection,
                    comparing ? undefined : filterStyle,
                  )}
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-[var(--ie-ink)]/45" />
              </>
            ) : null}
            <div
              ref={frameRef}
              data-ie-shape-frame
              className={cn(
                "overflow-visible",
                resizeInteract
                  ? "absolute bg-white ring-2 ring-[var(--ie-border)]/70"
                  : "relative h-full w-full rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm",
                cropMode && !shapeMaskInteract && !resizeInteract && "ring-2 ring-[var(--ie-border)]/20",
              )}
              style={
                resizeInteract
                  ? (resizeFrameBox ?? { left: 0, top: 0, width: "100%", height: "100%" })
                  : undefined
              }
            >
              {/* 底图固定：拖拽裁切框时不动 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className={cn("absolute inset-0", resizeInteract && "overflow-hidden")}>
              <img
                src={heldOriginal ?? (resizeInteract ? (imageUrl ?? backdrop) : backdrop)}
                alt="编辑底图"
                className={cn(
                  "absolute",
                  resizeInteract && resizePlace ? "max-w-none object-contain" : "inset-0 h-full w-full object-contain",
                  showCropResult && "opacity-0",
                )}
                style={
                  resizeInteract && resizePlace
                    ? {
                        left: `${(resizePlace.x / canvasWidth) * 100}%`,
                        top: `${(resizePlace.y / canvasHeight) * 100}%`,
                        width: `${(resizePlace.w / canvasWidth) * 100}%`,
                        height: `${(resizePlace.h / canvasHeight) * 100}%`,
                        ...composeFrameImageStyle(
                          `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                          liveCorrection,
                          comparing ? undefined : filterStyle,
                        ),
                      }
                    : composeFrameImageStyle("", liveCorrection, comparing ? undefined : filterStyle)
                }
                draggable={false}
              />
              </div>

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
                      className="pointer-events-none absolute inset-0 z-[12] h-full w-full rounded-lg object-contain"
                      style={composeFrameImageStyle("", liveCorrection)}
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

                  {shapeMask !== "none" ? <ShapeMaskDimOverlay shapeMask={shapeMask} /> : null}
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
                <>
                  {shapeMask !== "none" ? <ShapeMaskDimOverlay shapeMask={shapeMask} /> : null}
                  <ImageEditorRectCropRuleGrid />
                  <div
                    className="absolute inset-0 z-[19] cursor-move"
                    onPointerDown={onMoveResizeDown}
                  />
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heldOriginal ?? displayUrl ?? imageUrl ?? ""}
                    alt="编辑预览"
                    className={cn(
                      "absolute inset-0 h-full w-full",
                      fitInside ? "object-contain" : "object-cover",
                    )}
                    style={composeFrameImageStyle("", liveCorrection, comparing ? undefined : filterStyle)}
                    draggable={false}
                  />
                  {correctionInteract ? (
                    <div className="pointer-events-none absolute inset-0 z-[18]" aria-hidden>
                      <div className="absolute inset-y-0 left-1/3 w-px bg-white/70" />
                      <div className="absolute inset-y-0 left-1/2 w-px bg-white/90" />
                      <div className="absolute inset-y-0 left-2/3 w-px bg-white/70" />
                      <div className="absolute inset-x-0 top-1/3 h-px bg-white/70" />
                      <div className="absolute inset-x-0 top-1/2 h-px bg-white/90" />
                      <div className="absolute inset-x-0 top-2/3 h-px bg-white/70" />
                    </div>
                  ) : null}
                  {correctionInteract && showRulers ? (
                    <>
                      <div className="pointer-events-none absolute -top-4 left-0 right-0 h-4 bg-[var(--ie-cream)]/90 bg-[length:10%_100%] bg-repeat-x [background-image:linear-gradient(to_right,var(--ie-border)_1px,transparent_1px)]" />
                      <div className="pointer-events-none absolute -left-4 bottom-0 top-0 w-4 bg-[var(--ie-cream)]/90 bg-[length:100%_10%] bg-repeat-y [background-image:linear-gradient(to_bottom,var(--ie-border)_1px,transparent_1px)]" />
                    </>
                  ) : null}
                  {correctionInteract
                    ? guides.map((guide) => (
                        <div
                          key={guide.id}
                          className={cn(
                            "absolute z-[22] touch-none",
                            guide.axis === "h"
                              ? "left-0 right-0 h-3 -translate-y-1/2 cursor-ns-resize"
                              : "bottom-0 top-0 w-3 -translate-x-1/2 cursor-ew-resize",
                          )}
                          style={guide.axis === "h" ? { top: `${guide.pos}%` } : { left: `${guide.pos}%` }}
                          onPointerDown={onGuideDown(guide.id, guide.axis)}
                        >
                          <span
                            className={cn(
                              "absolute bg-[var(--ie-ink)] shadow-[0_0_0_1px_rgba(255,251,245,0.92)]",
                              guide.axis === "h"
                                ? "left-0 right-0 top-1/2 h-0.5 -translate-y-1/2"
                                : "bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2",
                            )}
                          />
                        </div>
                      ))
                    : null}
                </>
              )}

              {(resizeInteract || correctionInteract) && onShapeMaskCancel && onShapeMaskConfirm ? (
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
                    ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const
                  ).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={`调整尺寸 ${id}`}
                      style={{ touchAction: "none" }}
                      className={imageEditorFrameHandleClass(id)}
                      onPointerDown={onResizeHandleDown(id)}
                    />
                  ))}
                </div>
              ) : null}

              {textInteract &&
              textOverlay &&
              onSelectTextLayer &&
              onEditTextLayer &&
              onTextLayerPatch &&
              onTextExtrasPatch &&
              onTextContent &&
              onTextDuplicate &&
              onTextDelete &&
              onTextCopyStyle &&
              onTextAiFlower ? (
                <ImageEditorTextOverlay
                  overlay={textOverlay}
                  extras={textExtras ?? {}}
                  naturalWidth={naturalWidth}
                  naturalHeight={naturalHeight}
                  selectedLayerId={selectedTextLayerId ?? null}
                  selectedLayerIds={selectedTextLayerIds}
                  editingLayerId={editingTextLayerId ?? null}
                  disabled={busy}
                  onSelectLayer={onSelectTextLayer}
                  onEditLayer={onEditTextLayer}
                  onUpdateLayer={onTextLayerPatch}
                  onUpdateExtras={onTextExtrasPatch}
                  onUpdateText={onTextContent}
                  onDuplicate={onTextDuplicate}
                  onDelete={onTextDelete}
                  onCopyStyle={onTextCopyStyle}
                  onAiFlower={onTextAiFlower}
                />
              ) : null}

              {eraseOverlay}

              {busy ? <EcomMediaGeneratingBusy background="light" /> : null}
            </div>
            </div>
            </div>
          </div>
          {hand ? (
            <div
              className="absolute inset-0 z-[55] touch-none"
              role="region"
              aria-label="拖动整张图"
              style={{ cursor: panning ? "grabbing" : "grab" }}
              onPointerDown={onPanDown}
              onPointerMove={onPanMove}
              onPointerUp={onPanUp}
              onPointerCancel={onPanUp}
            />
          ) : null}
          </>
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
      {backdrop ? (
        <div
          className="absolute bottom-3 right-3 z-[70] flex items-end gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            {guideMenu ? (
              <div className="absolute bottom-11 right-0 w-40 overflow-hidden rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] py-1 text-[11px] text-[var(--ie-ink)] shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-[var(--ie-cream-muted)]"
                  onClick={() => setShowRulers((v) => !v)}
                >
                  <span>显示标尺</span>
                  <span className="text-[10px] text-[var(--ie-subtle)]">⌘+R</span>
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-[var(--ie-cream-muted)]"
                  onClick={() => addGuide("h")}
                >
                  横向参考线
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-[var(--ie-cream-muted)]"
                  onClick={() => addGuide("v")}
                >
                  竖向参考线
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
                  disabled={guides.length === 0}
                  onClick={() => {
                    setGuides([]);
                    setGuideMenu(false);
                  }}
                >
                  清空参考线
                </button>
              </div>
            ) : null}
            <button
              type="button"
              aria-label="参考线"
              aria-expanded={guideMenu}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-sm"
              onClick={() => {
                setLayerPanel(false);
                setZoomMenu(false);
                setGuideMenu((v) => !v);
              }}
            >
              <Hash className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div
            className="relative"
            onMouseEnter={() => setLayerHint(true)}
            onMouseLeave={() => setLayerHint(false)}
          >
            {layerPanel ? (
              <div
                role="dialog"
                aria-label="图层管理"
                className="absolute bottom-[calc(100%+10px)] left-1/2 z-[80] w-[280px] -translate-x-1/2 rounded-2xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] p-3 shadow-lg"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--ie-ink)]">图层管理</span>
                  <button
                    type="button"
                    aria-label="关闭图层"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] hover:text-[var(--ie-ink)]"
                    onClick={() => setLayerPanel(false)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <ul className="ecom-scrollbar-thin max-h-[min(320px,46vh)] space-y-2 overflow-y-auto">
                  {layerRows.map((row) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        title={row.label}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                          row.active
                            ? "bg-[var(--ie-cream)] ring-1 ring-[var(--ie-border)]"
                            : "bg-[var(--ie-cream-deep)] hover:bg-[var(--ie-cream-muted)]",
                        )}
                        onClick={() => onSelectTextLayer?.(row.selectId)}
                      >
                        {row.imageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.imageSrc}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md bg-[var(--ie-cream)] object-cover"
                            draggable={false}
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md px-1 text-center text-[10px] font-medium leading-tight"
                            style={{
                              color: row.color || "var(--ie-ink)",
                              background: row.bg || "var(--ie-cream)",
                            }}
                          >
                            {row.label.slice(0, 4)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--ie-ink)]">{row.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {layerHint && !layerPanel ? (
              <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[81] -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ie-ink)] px-2.5 py-1 text-[11px] text-[var(--ie-cream)] shadow-md">
                图层
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[var(--ie-ink)]" />
              </div>
            ) : null}
            <button
              type="button"
              aria-label="图层"
              aria-expanded={layerPanel}
              title="图层"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm",
                layerPanel
                  ? "border-[var(--ie-border)] bg-[var(--ie-ink)] text-[var(--ie-cream)]"
                  : "border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[var(--ie-ink)]",
              )}
              onClick={() => {
                setGuideMenu(false);
                setZoomMenu(false);
                setLayerPanel((v) => !v);
              }}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            aria-label="移动画布"
            aria-pressed={hand}
            title="移动画布"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm",
              hand
                ? "border-[#0071e3] bg-[var(--ie-cream)] text-[#0071e3]"
                : "border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[var(--ie-ink)]",
            )}
            onClick={() => {
              setGuideMenu(false);
              setZoomMenu(false);
              setLayerPanel(false);
              setHand((value) => !value);
            }}
          >
            <Hand className="h-3.5 w-3.5" aria-hidden />
          </button>
          <div className="inline-flex h-8 items-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[11px] text-[var(--ie-ink)] shadow-sm">
            <button
              type="button"
              aria-label="缩小"
              className="inline-flex h-8 w-7 items-center justify-center"
              onClick={() => stepShownZoom(-10)}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div
              ref={zoomBoxRef}
              className="relative"
              onMouseEnter={() => setZoomHint(true)}
              onMouseLeave={() => setZoomHint(false)}
            >
              {zoomMenu ? (
                <div
                  role="menu"
                  aria-label="缩放"
                  className="absolute bottom-[calc(100%+46px)] left-1/2 z-[82] w-[88px] -translate-x-1/2 rounded-2xl bg-black/55 py-2 text-center text-[13px] leading-none text-white shadow-lg backdrop-blur-md"
                >
                  {ZOOM_PRESETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      className="block w-full py-[7px] hover:bg-white/15"
                      onClick={() => {
                        applyShownZoom(value);
                        setZoomMenu(false);
                      }}
                    >
                      {value}%
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full py-[7px] hover:bg-white/15"
                    onClick={fitToScreen}
                  >
                    适应屏幕
                  </button>
                </div>
              ) : null}
              {zoomHint ? (
                <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[83] -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/70 px-3 py-1.5 text-center text-white shadow-md">
                  <div className="text-[12px] leading-4">实际大小</div>
                  {canvasSizeLabel ? (
                    <div className="text-[10px] leading-4 text-white/85">画布尺寸: {canvasSizeLabel}</div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className={cn(
                  "min-w-10 px-1 text-center tabular-nums",
                  (zoomMenu || zoomHint) && "text-[#0071e3]",
                )}
                aria-expanded={zoomMenu}
                aria-label="缩放比例"
                onClick={() => {
                  setGuideMenu(false);
                  setLayerPanel(false);
                  setZoomMenu((open) => !open);
                }}
              >
                {frameLayout.shownZoom}%
              </button>
            </div>
            <button
              type="button"
              aria-label="放大"
              className="inline-flex h-8 w-7 items-center justify-center"
              onClick={() => stepShownZoom(10)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div
            className="relative"
            onMouseEnter={() => setCompareHint(true)}
            onMouseLeave={() => setCompareHint(false)}
          >
            {compareHint || comparing ? (
              <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ie-ink)] px-2.5 py-1 text-[11px] text-[var(--ie-cream)] shadow-md">
                长按查看原图
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[var(--ie-ink)]" />
              </div>
            ) : null}
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] text-[var(--ie-ink)] shadow-sm",
                comparing
                  ? "border-[var(--ie-border)] bg-[var(--ie-cream-muted)]"
                  : "border-[var(--ie-border-soft)] bg-[var(--ie-cream)]",
              )}
              onPointerDown={startCompare}
              onPointerUp={endCompare}
              onPointerCancel={endCompare}
              onContextMenu={(e) => e.preventDefault()}
            >
              <SquareSplitHorizontal className="h-3.5 w-3.5" aria-hidden />
              对比
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}