"use client";

import type React from "react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { computeImageContainRect } from "@private/ecom-copy-overlay/layout-coords";
import {
  layerPreviewCanvasFx,
  overlayLineHeightPx,
  resolveLayerFontCss,
  type EcomCopyOverlay,
  type EcomCopyOverlayLayer,
} from "@private/ecom-copy-overlay";
import { CopyPlus, MoreHorizontal, Paintbrush, RotateCw, Trash2 } from "lucide-react";

import {
  IMAGE_EDITOR_TEXT_PLACEHOLDER,
  isTextGrouped,
  layersSharingGroup,
  resolveTextLayout,
  textLayoutSpec,
  type ImageEditorTextLayerExtras,
} from "@/lib/image-editor-text";
import { IMAGE_EDITOR_POSTER_EM } from "@/lib/image-editor-poster-pieces";
import { imageEditorTextAdjustStyle, imageEditorTextEffectStyle } from "@/lib/image-editor-text-effects";
import { imageEditorFlowerStyle } from "@/lib/image-editor-text-flower";
import { imageEditorHighlightStyle } from "@/lib/image-editor-text-highlights";
import { imageEditorTextTemplateById, isImageEditorShapeKind } from "@/lib/image-editor-text-templates";
import { warpBoxSize, warpPathD } from "@/lib/image-editor-text-warps";
import { normalizeRotateDeg } from "@/lib/image-editor-transform";
import { DecorShape, SellingLine, SellingPointCard, ShapeTextArt, decorBoxEm, type SellingMarkHandle } from "@/components/image-editor/image-editor-text-template-art";
import { cn } from "@/lib/utils";

type TextResizeHandleId = "nw" | "ne" | "w" | "e" | "sw" | "se";

const TEXT_HANDLE_POS: Record<TextResizeHandleId, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
};

const TEXT_HANDLE_CURSOR: Record<TextResizeHandleId, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  e: "ew-resize",
  w: "ew-resize",
};

type Props = {
  overlay: EcomCopyOverlay;
  extras: Record<string, ImageEditorTextLayerExtras>;
  naturalWidth: number;
  naturalHeight: number;
  selectedLayerId: string | null;
  selectedLayerIds?: string[];
  editingLayerId: string | null;
  disabled?: boolean;
  onSelectLayer: (id: string | null, extra?: { additive?: boolean }) => void;
  onEditLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<EcomCopyOverlayLayer>) => void;
  onUpdateExtras: (id: string, patch: Partial<ImageEditorTextLayerExtras>) => void;
  onUpdateText: (id: string, text: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyStyle: (id: string) => void;
  onAiFlower: (id: string) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function ImageEditorTextOverlay({
  overlay,
  extras,
  naturalWidth,
  naturalHeight,
  selectedLayerId,
  selectedLayerIds,
  editingLayerId,
  disabled,
  onSelectLayer,
  onEditLayer,
  onUpdateLayer,
  onUpdateExtras,
  onUpdateText,
  onDuplicate,
  onDelete,
  onCopyStyle,
  onAiFlower,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentElRef = useRef<HTMLDivElement>(null);
  const editHolder = useRef({ el: null as HTMLTextAreaElement | HTMLInputElement | null });
  const bindEdit = useCallback((node: HTMLTextAreaElement | HTMLInputElement | null) => {
    editHolder.current.el = node;
  }, []);
  const sellingLineRef = useRef(0);
  const [frameSize, setFrameSize] = useState({ w: 1, h: 1 });
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ id: string; text: string } | null>(null);
  const editDraftRef = useRef(editDraft);
  editDraftRef.current = editDraft;
  const onUpdateTextRef = useRef(onUpdateText);
  onUpdateTextRef.current = onUpdateText;
  if ((editingLayerId ?? null) !== (editDraft?.id ?? null)) {
    if (editDraft) {
      const next = editDraft.text.trim() ? editDraft.text : IMAGE_EDITOR_TEXT_PLACEHOLDER;
      onUpdateTextRef.current(editDraft.id, next);
      editDraftRef.current = null;
    }
    const text = editingLayerId ? overlay.layers.find((l) => l.id === editingLayerId)?.text ?? "" : "";
    setEditDraft(editingLayerId ? { id: editingLayerId, text } : null);
  }
  useEffect(() => {
    const draft = editDraftRef.current;
    if (!draft || editingLayerId === draft.id) return;
    editDraftRef.current = null;
    const next = draft.text.trim() ? draft.text : IMAGE_EDITOR_TEXT_PLACEHOLDER;
    onUpdateTextRef.current(draft.id, next);
    setEditDraft(null);
  }, [editingLayerId]);
  const contentRef = useRef({ x: 0, y: 0, w: 1, h: 1 });

  const content = useMemo(() => {
    const iw = naturalWidth > 0 ? naturalWidth : overlay.exportWidthPx;
    const ih = naturalHeight > 0 ? naturalHeight : Math.round(overlay.exportWidthPx * 0.75);
    return computeImageContainRect(frameSize.w, frameSize.h, iw, ih);
  }, [frameSize.h, frameSize.w, naturalHeight, naturalWidth, overlay.exportWidthPx]);

  contentRef.current = content;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setFrameSize({ w: r.width, h: r.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!editingLayerId) return;
    const ta = editHolder.current.el;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, [editingLayerId]);

  const resizingRef = useRef(false);
  const [markLayerId, setMarkLayerId] = useState<string | null>(null);
  const [groupRect, setGroupRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [posterLayoutTick, setPosterLayoutTick] = useState(0);
  const dragArmRef = useRef<{
    startX: number;
    startY: number;
    members: { id: string; nx: number; ny: number }[];
  } | null>(null);

  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    members: { id: string; nx: number; ny: number }[];
  } | null>(null);

  const groupMembersOf = useCallback(
    (layerId: string) => {
      const groupId = extras[layerId]?.groupId;
      if (!groupId || !isTextGrouped(extras[layerId])) return [];
      return layersSharingGroup(overlay.layers, extras, groupId);
    },
    [extras, overlay.layers],
  );

  const dismissFocus = useCallback(() => {
    onEditLayer(null);
    onSelectLayer(null);
  }, [onEditLayer, onSelectLayer]);

  const scaleToExport = content.w / Math.max(1, overlay.exportWidthPx);

  const updateLayer = useCallback(
    (id: string, patch: Partial<EcomCopyOverlayLayer>) => {
      onUpdateLayer(id, patch);
    },
    [onUpdateLayer],
  );

  useEffect(() => {
    if (disabled) return;
    const onMove = (e: PointerEvent) => {
      if (resizingRef.current) return;
      const arm = dragArmRef.current;
      if (arm && !drag) {
        if (Math.hypot(e.clientX - arm.startX, e.clientY - arm.startY) >= 4) {
          setMarkLayerId(null);
          setDrag({ ...arm });
          dragArmRef.current = null;
        }
        return;
      }
      if (!drag) return;
      const c = contentRef.current;
      const spanW = Math.max(1, c.w);
      const spanH = Math.max(1, c.h);
      // 文字可以拖进图片两侧的空白，整组用同一个位移，避免左边先顶住、右边继续滑。
      const minNx = -c.x / spanW;
      const maxNx = (Math.max(spanW, frameSize.w) - c.x) / spanW;
      const minNy = -c.y / spanH;
      const maxNy = (Math.max(spanH, frameSize.h) - c.y) / spanH;
      let dx = (e.clientX - drag.startX) / spanW;
      let dy = (e.clientY - drag.startY) / spanH;
      for (const member of drag.members) {
        dx = clamp(dx, minNx - member.nx, maxNx - member.nx);
        dy = clamp(dy, minNy - member.ny, maxNy - member.ny);
      }
      for (const member of drag.members) {
        updateLayer(member.id, {
          nx: member.nx + dx,
          ny: member.ny + dy,
        });
      }
    };
    const onUp = () => {
      dragArmRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [disabled, drag, frameSize.h, frameSize.w, updateLayer]);

  const beginTextResize = (
    e: React.PointerEvent<HTMLButtonElement>,
    layer: EcomCopyOverlayLayer,
    handle: TextResizeHandleId,
  ) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    dragArmRef.current = null;
    setDrag(null);
    resizingRef.current = true;
    onSelectLayer(layer.id);
    const frameEl = e.currentTarget.closest<HTMLElement>("[data-text-frame]");
    const c = contentRef.current;
    const contentRect = contentElRef.current?.getBoundingClientRect();
    const boxRect = frameEl?.getBoundingClientRect();
    const scaleX = contentRect && contentRect.width > 1 && c.w > 0 ? contentRect.width / c.w : 1;
    const scaleY = contentRect && contentRect.height > 1 && c.h > 0 ? contentRect.height / c.h : 1;
    const startBoxW = Math.max(12, frameEl?.offsetWidth ?? boxRect?.width ?? 48);
    const startBoxH = Math.max(12, frameEl?.offsetHeight ?? boxRect?.height ?? 24);
    const anchor = textLayoutSpec(resolveTextLayout(layer, extras[layer.id]));
    const paired = extras[layer.id]?.role === "decor" || extras[layer.id]?.role === "label";
    if (paired) {
      anchor.ax = 0.5;
      anchor.ay = 0.5;
    }
    const left = layer.nx * c.w - anchor.ax * startBoxW;
    const right = left + startBoxW;
    const top = layer.ny * c.h - anchor.ay * startBoxH;
    const bottom = top + startBoxH;
    const startX = e.clientX;
    const startY = e.clientY;
    const startFont = layer.fontSize;
    const startMaxW = layer.maxWidthNorm ?? 0.88;
    const startFrameW = layer.layoutBoxWidthPx;
    const sideHandle = handle === "e" || handle === "w";
    const pointerId = e.pointerId;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = TEXT_HANDLE_CURSOR[handle];
    const exportScale = scaleToExport > 0 ? scaleToExport : 1;
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const dx = (ev.clientX - startX) / scaleX;
      const dy = (ev.clientY - startY) / scaleY;
      if (sideHandle) {
        const delta = handle === "e" ? dx : -dx;
        const newBoxW = clamp(startBoxW + delta, 32, 8000);
        const newLeft = handle === "e" ? left : right - newBoxW;
        updateLayer(layer.id, {
          layoutBoxWidthPx: newBoxW / exportScale,
          maxWidthNorm: clamp(newBoxW / Math.max(1, c.w), 0.02, 4),
          nx: clamp((newLeft + anchor.ax * newBoxW) / Math.max(1, c.w), -1, 2),
        });
        return;
      }
      const outwardX = handle === "ne" || handle === "se" ? 1 : -1;
      const outwardY = handle === "sw" || handle === "se" ? 1 : -1;
      const along = dx * outwardX + dy * outwardY;
      const scale = clamp((Math.max(startBoxW, startBoxH) + along) / Math.max(startBoxW, startBoxH), 0.2, 6);
      const newBoxW = startBoxW * scale;
      const newBoxH = startBoxH * scale;
      const newLeft = outwardX > 0 ? left : right - newBoxW;
      const newTop = outwardY > 0 ? top : bottom - newBoxH;
      updateLayer(layer.id, {
        fontSize: clamp(Math.round(startFont * scale), 10, 480),
        maxWidthNorm: clamp(startMaxW * scale, 0.08, 0.98),
        layoutBoxWidthPx:
          startFrameW != null && startFrameW > 0 ? (newBoxW / exportScale) : undefined,
        nx: clamp((newLeft + anchor.ax * newBoxW) / Math.max(1, c.w), -1, 2),
        ny: clamp((newTop + anchor.ay * newBoxH) / Math.max(1, c.h), -1, 2),
      });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      resizingRef.current = false;
      document.body.style.cursor = prevCursor;
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
  };

  const selectedGroupId = (() => {
    if (!selectedLayerId || markLayerId || editingLayerId) return null;
    const selectedExtras = extras[selectedLayerId];
    if (!isTextGrouped(selectedExtras) || !selectedExtras?.groupId) return null;
    return selectedExtras.groupId;
  })();

  useLayoutEffect(() => {
    const root = contentElRef.current;
    if (!root || !selectedGroupId) {
      setGroupRect(null);
      return;
    }
    const nodes = root.querySelectorAll<HTMLElement>(`[data-group-id="${CSS.escape(selectedGroupId)}"]`);
    if (!nodes.length) {
      setGroupRect(null);
      return;
    }
    const bounds = root.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      minX = Math.min(minX, rect.left - bounds.left);
      minY = Math.min(minY, rect.top - bounds.top);
      maxX = Math.max(maxX, rect.right - bounds.left);
      maxY = Math.max(maxY, rect.bottom - bounds.top);
    });
    const next = { x: minX, y: minY, w: Math.max(8, maxX - minX), h: Math.max(8, maxY - minY) };
    setGroupRect((current) =>
      current &&
      Math.abs(current.x - next.x) < 0.5 &&
      Math.abs(current.y - next.y) < 0.5 &&
      Math.abs(current.w - next.w) < 0.5 &&
      Math.abs(current.h - next.h) < 0.5
        ? current
        : next,
    );
  }, [content, extras, frameSize, overlay, posterLayoutTick, selectedGroupId]);

  const beginMarkResize = (
    e: React.PointerEvent<HTMLButtonElement>,
    layer: EcomCopyOverlayLayer,
    handle: SellingMarkHandle,
  ) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    dragArmRef.current = null;
    setDrag(null);
    resizingRef.current = true;
    const layerExtras = extras[layer.id];
    const mark = layerExtras?.mark;
    const decorBox = layerExtras?.role === "decor" ? decorBoxEm(layerExtras.shapeKind) : null;
    const startW = layerExtras?.markW ?? decorBox?.w ?? (mark === "num" ? 1.6 : mark === "line" ? 0.9 : 1.05);
    const startH = layerExtras?.markH ?? decorBox?.h ?? (mark === "line" ? 0.7 : 1.05);
    const fontPx = Math.max(10, layer.fontSize * scaleToExport);
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = handle === "n" || handle === "s" ? "ns-resize" : handle === "e" || handle === "w" ? "ew-resize" : "nwse-resize";
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dw = (ev.clientX - startX) / fontPx;
      const dh = (ev.clientY - startY) / fontPx;
      const corner = handle === "nw" || handle === "ne" || handle === "sw" || handle === "se";
      let markW = startW;
      let markH = startH;
      if (corner) {
        const outwardX = handle === "ne" || handle === "se" ? 1 : -1;
        const outwardY = handle === "sw" || handle === "se" ? 1 : -1;
        const along = dw * outwardX + dh * outwardY;
        const scale = clamp((Math.max(startW, startH) + along) / Math.max(startW, startH), 0.35, 5);
        markW = startW * scale;
        markH = startH * scale;
      } else {
        if (handle === "e") markW = startW + dw;
        if (handle === "w") markW = startW - dw;
        if (handle === "s") markH = startH + dh;
        if (handle === "n") markH = startH - dh;
      }
      onUpdateExtras(layer.id, { markW: clamp(markW, 0.35, 24), markH: clamp(markH, 0.2, 12) });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      resizingRef.current = false;
      document.body.style.cursor = prevCursor;
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
  };

  const beginGroupResize = (e: React.PointerEvent<HTMLButtonElement>, handle: TextResizeHandleId) => {
    if (disabled || !selectedGroupId) return;
    e.stopPropagation();
    e.preventDefault();
    dragArmRef.current = null;
    setDrag(null);
    resizingRef.current = true;
    const members = layersSharingGroup(overlay.layers, extras, selectedGroupId).map((item) => ({
      id: item.id,
      nx: item.nx,
      ny: item.ny,
      fontSize: item.fontSize,
    }));
    const box = e.currentTarget.closest<HTMLElement>("[data-text-group]");
    const contentRect = contentElRef.current?.getBoundingClientRect();
    const boxRect = box?.getBoundingClientRect();
    if (!contentRect || !boxRect || !members.length) {
      resizingRef.current = false;
      return;
    }
    const c = contentRef.current;
    const scaleX = contentRect.width > 1 && c.w > 0 ? contentRect.width / c.w : 1;
    const scaleY = contentRect.height > 1 && c.h > 0 ? contentRect.height / c.h : 1;
    const left = (boxRect.left - contentRect.left) / scaleX;
    const top = (boxRect.top - contentRect.top) / scaleY;
    const width = boxRect.width / scaleX;
    const height = boxRect.height / scaleY;
    const right = left + width;
    const bottom = top + height;
    const startX = e.clientX;
    const startY = e.clientY;
    const sideHandle = handle === "e" || handle === "w";
    const pointerId = e.pointerId;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = TEXT_HANDLE_CURSOR[handle];
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = (ev.clientX - startX) / scaleX;
      const dy = (ev.clientY - startY) / scaleY;
      let scale = 1;
      let originX = left;
      let originY = top;
      if (sideHandle) {
        const delta = handle === "e" ? dx : -dx;
        scale = clamp((width + delta) / Math.max(12, width), 0.2, 6);
        originX = handle === "e" ? left : right;
        originY = top + height / 2;
      } else {
        const outwardX = handle === "ne" || handle === "se" ? 1 : -1;
        const outwardY = handle === "sw" || handle === "se" ? 1 : -1;
        const along = dx * outwardX + dy * outwardY;
        scale = clamp((Math.max(width, height) + along) / Math.max(width, height), 0.2, 6);
        originX = outwardX > 0 ? left : right;
        originY = outwardY > 0 ? top : bottom;
      }
      for (const member of members) {
        const px = member.nx * c.w;
        const py = member.ny * c.h;
        updateLayer(member.id, {
          fontSize: clamp(Math.round(member.fontSize * scale), 10, 480),
          nx: clamp((originX + (px - originX) * scale) / Math.max(1, c.w), -1, 2),
          ny: sideHandle ? member.ny : clamp((originY + (py - originY) * scale) / Math.max(1, c.h), -1, 2),
        });
      }
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      resizingRef.current = false;
      document.body.style.cursor = prevCursor;
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
  };

  const beginLayerRotate = (e: React.PointerEvent<HTMLButtonElement>, layerIds: string[]) => {
    if (disabled || !layerIds.length) return;
    e.stopPropagation();
    e.preventDefault();
    dragArmRef.current = null;
    setDrag(null);
    resizingRef.current = true;
    const frame = e.currentTarget.closest<HTMLElement>("[data-text-frame], [data-text-group]");
    const rect = frame?.getBoundingClientRect();
    const contentRect = contentElRef.current?.getBoundingClientRect();
    if (!rect || !contentRect) {
      resizingRef.current = false;
      return;
    }
    const c = contentRef.current;
    const pivotX = rect.left + rect.width / 2;
    const pivotY = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - pivotY, e.clientX - pivotX);
    const scaleX = contentRect.width > 1 && c.w > 0 ? contentRect.width / c.w : 1;
    const scaleY = contentRect.height > 1 && c.h > 0 ? contentRect.height / c.h : 1;
    const orbit = layerIds.length > 1;
    const members = layerIds.flatMap((id) => {
      const layer = overlay.layers.find((item) => item.id === id);
      const node = contentElRef.current?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`);
      if (!layer || !node) return [];
      const box = node.getBoundingClientRect();
      const anchor = textLayoutSpec(resolveTextLayout(layer, extras[id]));
      if (extras[id]?.role === "decor" || extras[id]?.role === "label") {
        anchor.ax = 0.5;
        anchor.ay = 0.5;
      }
      return [
        {
          id,
          ax: anchor.ax,
          ay: anchor.ay,
          boxW: Math.max(1, node.offsetWidth),
          boxH: Math.max(1, node.offsetHeight),
          cx: box.left + box.width / 2,
          cy: box.top + box.height / 2,
          rotate: extras[id]?.rotateDeg ?? 0,
        },
      ];
    });
    if (!members.length) {
      resizingRef.current = false;
      return;
    }
    const pointerId = e.pointerId;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const angle = Math.atan2(ev.clientY - pivotY, ev.clientX - pivotX);
      const delta = angle - startAngle;
      const cos = Math.cos(delta);
      const sin = Math.sin(delta);
      const deg = (delta * 180) / Math.PI;
      for (const member of members) {
        if (orbit) {
          const dx = member.cx - pivotX;
          const dy = member.cy - pivotY;
          const nextCx = pivotX + dx * cos - dy * sin;
          const nextCy = pivotY + dx * sin + dy * cos;
          const contentX = (nextCx - contentRect.left) / scaleX;
          const contentY = (nextCy - contentRect.top) / scaleY;
          updateLayer(member.id, {
            nx: clamp((contentX + member.ax * member.boxW - member.boxW / 2) / Math.max(1, c.w), -1, 2),
            ny: clamp((contentY + member.ay * member.boxH - member.boxH / 2) / Math.max(1, c.h), -1, 2),
          });
        }
        onUpdateExtras(member.id, { rotateDeg: normalizeRotateDeg(member.rotate + deg) });
      }
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      resizingRef.current = false;
      document.body.style.cursor = prevCursor;
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute inset-0 z-[35]"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-text-layer]") || (e.target as HTMLElement).closest("[data-text-group]")) return;
        setMarkLayerId(null);
        dismissFocus();
      }}
    >
      <div
        ref={contentElRef}
        data-text-content="1"
        className="absolute"
        style={{
          left: content.x,
          top: content.y,
          width: content.w,
          height: content.h,
        }}
      >
        {overlay.layers.map((layer) => {
          const selected =
            selectedLayerId === layer.id || (selectedLayerIds?.includes(layer.id) ?? false);
          const editing = editingLayerId === layer.id;
          const hovered = hoveredLayerId === layer.id;
          const layerExtras = extras[layer.id];
          const layout = textLayoutSpec(resolveTextLayout(layer, layerExtras));
          const paired = layerExtras?.role === "decor" || layerExtras?.role === "label";
          if (paired) {
            layout.ax = 0.5;
            layout.ay = 0.5;
          }
          const align = layerExtras?.align ?? layer.textAlign ?? layout.textAlign;
          const distribute = align === "justify";
          const fontPx = Math.max(10, layer.fontSize * scaleToExport);
          const frameW =
            layer.layoutBoxWidthPx != null && layer.layoutBoxWidthPx > 0
              ? layer.layoutBoxWidthPx * scaleToExport
              : undefined;
          const anchorX = layer.nx * content.w;
          const anchorY = layer.ny * content.h;
          const glyphFlip =
            layerExtras?.flipH || layerExtras?.flipV
              ? `scale(${layerExtras?.flipH ? -1 : 1}, ${layerExtras?.flipV ? -1 : 1})`
              : undefined;
          const fx = layerPreviewCanvasFx(layer, scaleToExport);
          const lineHeightUnitless = overlayLineHeightPx(layer) / Math.max(1, layer.fontSize);
          const opacity = (layerExtras?.opacity ?? 100) / 100;
          const lineMark = layerExtras?.mark;
          const inSelectedGroup =
            Boolean(selectedLayerId) &&
            isTextGrouped(extras[selectedLayerId ?? ""]) &&
            extras[selectedLayerId ?? ""]?.groupId === layerExtras?.groupId &&
            markLayerId == null &&
            !editingLayerId;
          const markActive = markLayerId === layer.id && !editing;
          const showHoverChrome = hovered && !selected && !editing && !inSelectedGroup;
          const showHoverTip = showHoverChrome;
          const showSelectedChrome = (selected || editing) && !inSelectedGroup && !markActive;
          const primary = selectedLayerId === layer.id;
          const showToolbar = primary && !inSelectedGroup && !markActive;
          const showHandles = primary && !editing && !inSelectedGroup && !markActive;
          const flower = imageEditorFlowerStyle(layerExtras?.flowerId, fontPx);
          const effect = flower ? null : imageEditorTextEffectStyle(layerExtras?.effectId, fontPx);
          const adjust = imageEditorTextAdjustStyle(layer, layerExtras, scaleToExport);
          const glyphText = (editing ? editDraft?.text : layer.text) || "\u200b";
          const warpBox = layerExtras?.warpId ? warpBoxSize(layerExtras.warpId, glyphText, fontPx) : null;
          const warpD =
            !editing && layerExtras?.warpId && layout.writingMode !== "vertical" && warpBox
              ? warpPathD(layerExtras.warpId, warpBox.w, warpBox.h)
              : null;

          const typeBase: React.CSSProperties = {
            fontFamily: resolveLayerFontCss(layer),
            fontWeight: layer.fontWeight === "normal" ? 400 : effect ? 800 : 700,
            fontSize: fontPx,
            lineHeight: layerExtras?.lineHeight ? layerExtras.lineHeight / 100 : lineHeightUnitless,
            letterSpacing: layerExtras?.letterSpacing ? `${layerExtras.letterSpacing}px` : undefined,
            fontStyle: layerExtras?.italic ? "italic" : undefined,
            textDecoration: [
              layerExtras?.underline ? "underline" : "",
              layerExtras?.strike ? "line-through" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined,
            writingMode: layout.writingMode === "vertical" ? "vertical-rl" : "horizontal-tb",
            textAlign: distribute ? "justify" : align,
            textAlignLast: distribute ? "justify" : undefined,
            textJustify: distribute ? "inter-character" : undefined,
            whiteSpace: "pre",
            wordBreak: "normal",
          };
          const painted = flower ?? effect;
          const fillStyle: React.CSSProperties = mergeHighlight(
            painted ? { ...typeBase, ...painted.fill } : { ...typeBase, ...adjust.fill },
            imageEditorHighlightStyle(layerExtras?.highlightId, layerExtras?.highlightColor),
          );
          const underlayShadow = flower?.underlayShadow ?? effect?.underlayShadow;
          const template = imageEditorTextTemplateById(layerExtras?.templateId);
          const sellingTemplate = template?.kind === "selling" ? template : null;
          const shapeTemplate =
            template && isImageEditorShapeKind(template.kind) && layerExtras?.role !== "label" && layerExtras?.role !== "decor"
              ? template
              : null;
          const boxBackgroundColor = effect ? fx.boxBackgroundColor : adjust.boxBackgroundColor;
          const boxPadding = effect ? fx.boxPadding : adjust.boxPadding;
          const boxRadius = effect ? fx.boxRadius : adjust.boxRadius;

          return (
            <div
              key={layer.id}
              data-text-layer="1"
              data-text-frame="1"
              data-layer-id={layer.id}
              data-group-id={layerExtras?.groupId}
              className={cn(
                "absolute",
                (showHoverChrome || showSelectedChrome) && "ring-2 ring-[#3d7eff]/85",
              )}
              style={{
                left: 0,
                top: 0,
                width: frameW ?? "max-content",
                maxWidth: "none",
                textAlign: align,
                cursor: disabled ? "default" : editing ? "text" : selected ? "move" : "default",
                backgroundColor: boxBackgroundColor,
                padding: boxPadding,
                borderRadius: boxRadius,
                transform: [
                  `translate(${anchorX}px, ${anchorY}px)`,
                  `translate(${-layout.ax * 100}%, ${-layout.ay * 100}%)`,
                  layerExtras?.rotateDeg ? `rotate(${layerExtras.rotateDeg}deg)` : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              }}
            >
              {showToolbar ? (
                <TextFloatingToolbar
                  onAi={() => onAiFlower(layer.id)}
                  onDuplicate={() => onDuplicate(layer.id)}
                  onCopyStyle={() => onCopyStyle(layer.id)}
                  onDelete={() => onDelete(layer.id)}
                />
              ) : null}

              {showHoverTip && !layerExtras?.posterSrc ? <HoverTip label="双击修改文字" /> : null}

              <div
                className="relative"
                onMouseEnter={() => setHoveredLayerId(layer.id)}
                onMouseLeave={() => setHoveredLayerId((cur) => (cur === layer.id ? null : cur))}
                onPointerDown={(e) => {
                  if (disabled || editing) return;
                  if ((e.target as HTMLElement).closest("[data-text-handle]")) return;
                  if ((e.target as HTMLElement).closest("[data-text-edit]")) return;
                  e.stopPropagation();
                  onSelectLayer(layer.id, { additive: e.shiftKey || e.metaKey });
                  const markHit = (e.target as HTMLElement).closest("[data-text-mark]");
                  setMarkLayerId(markHit && !isTextGrouped(layerExtras) ? layer.id : null);
                  setDrag(null);
                  const members = groupMembersOf(layer.id);
                  dragArmRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    members: (members.length ? members : [layer]).map((item) => ({ id: item.id, nx: item.nx, ny: item.ny })),
                  };
                }}
                onDoubleClick={(e) => {
                  if (disabled || layerExtras?.posterSrc) return;
                  e.preventDefault();
                  e.stopPropagation();
                  dragArmRef.current = null;
                  setDrag(null);
                  if ((e.target as HTMLElement).closest("[data-text-mark]")) return;
                  const row = (e.target as HTMLElement).closest("[data-selling-line]");
                  sellingLineRef.current = row ? Number(row.getAttribute("data-selling-line")) || 0 : 0;
                  onSelectLayer(layer.id);
                  onEditLayer(layer.id);
                }}
              >
                {layerExtras?.shapeKind === "bar" ? (
                  <div
                    data-text-glyphs="1"
                    data-text-mark="1"
                    className="relative"
                    style={{
                      width: `${layerExtras.markW ?? 4}em`,
                      height: `${layerExtras.markH ?? 1.2}em`,
                      fontSize: fontPx,
                      background: layer.color || layerExtras.shapeColor || "#f5c451",
                      borderRadius: layerExtras.shapeBg === "pill" ? 999 : fontPx * 0.35,
                      opacity,
                    }}
                  >
                    {markActive
                      ? (["nw", "ne", "e", "se", "sw", "w"] as const).map((id) => (
                          <button
                            key={id}
                            type="button"
                            data-text-handle="1"
                            aria-label={`拉伸色块 ${id}`}
                            className="pointer-events-auto absolute z-30 h-2 w-2 rounded-[2px] border border-white bg-[#2a2420]"
                            style={{
                              touchAction: "none",
                              left: id.includes("w") ? 0 : id === "e" ? "100%" : undefined,
                              right: id.includes("e") ? 0 : undefined,
                              top: id.includes("n") ? 0 : id === "e" || id === "w" ? "50%" : undefined,
                              bottom: id.includes("s") ? 0 : undefined,
                              transform: "translate(-50%, -50%)",
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              beginMarkResize(event, layer, id);
                            }}
                          />
                        ))
                      : null}
                  </div>
                ) : layerExtras?.posterSrc ? (
                  <img
                    data-text-glyphs="1"
                    src={layerExtras.posterSrc}
                    alt=""
                    draggable={false}
                    onLoad={() => setPosterLayoutTick((tick) => tick + 1)}
                    style={{
                      width: frameW ?? fontPx * (layerExtras.posterWidthEm ?? IMAGE_EDITOR_POSTER_EM),
                      height: layerExtras.posterHeightEm ? fontPx * layerExtras.posterHeightEm : "auto",
                      display: "block",
                      opacity,
                      transform: glyphFlip,
                    }}
                  />
                ) : layerExtras?.role === "decor" ? (
                  <div data-text-glyphs="1" style={{ opacity, transform: glyphFlip }}>
                    <DecorShape
                      kind={(layerExtras.shapeKind as "stamp") || "stamp"}
                      color={layerExtras.shapeColor || layer.color || "#1d1d1f"}
                      bg={layerExtras.shapeBg}
                      fontPx={fontPx}
                      boxW={layerExtras.markW}
                      boxH={layerExtras.markH}
                      active={markActive}
                      onPointerDown={(event) => {
                        if (disabled) return;
                        event.stopPropagation();
                        onSelectLayer(layer.id);
                        setMarkLayerId(layer.id);
                        setDrag(null);
                        const members = groupMembersOf(layer.id);
                        dragArmRef.current = {
                          startX: event.clientX,
                          startY: event.clientY,
                          members: (members.length ? members : [layer]).map((item) => ({ id: item.id, nx: item.nx, ny: item.ny })),
                        };
                      }}
                      onResize={(handle, event) => beginMarkResize(event, layer, handle)}
                    />
                  </div>
                ) : lineMark ? (
                  <div data-text-glyphs="1" style={{ opacity, transform: glyphFlip }}>
                    <SellingLine
                      mark={lineMark}
                      index={
                        layerExtras?.groupId
                          ? Math.max(0, layersSharingGroup(overlay.layers, extras, layerExtras.groupId).findIndex((item) => item.id === layer.id))
                          : 0
                      }
                      text={editing ? (editDraft?.text ?? layer.text ?? "") : layer.text || "商品卖点"}
                      fontPx={fontPx}
                      color={layer.color}
                      fontFamily={resolveLayerFontCss(layer)}
                      fontWeight={layer.fontWeight === "normal" ? 400 : 700}
                      editing={editing}
                      markW={layerExtras?.markW ?? (lineMark === "num" ? 1.6 : lineMark === "line" ? 0.9 : 1.05)}
                      markH={layerExtras?.markH ?? (lineMark === "line" ? 0.7 : 1.05)}
                      markColor={layerExtras?.markColor}
                      markActive={markActive}
                      onChange={(text) => setEditDraft({ id: layer.id, text })}
                      onCommit={(text) => {
                        const next = text.trim() ? text : IMAGE_EDITOR_TEXT_PLACEHOLDER;
                        onUpdateText(layer.id, next);
                        onEditLayer(null);
                      }}
                      onMarkPointerDown={(event) => {
                        if (disabled) return;
                        event.stopPropagation();
                        onSelectLayer(layer.id);
                        setMarkLayerId(layer.id);
                        setDrag(null);
                        const members = groupMembersOf(layer.id);
                        dragArmRef.current = {
                          startX: event.clientX,
                          startY: event.clientY,
                          members: (members.length ? members : [layer]).map((item) => ({ id: item.id, nx: item.nx, ny: item.ny })),
                        };
                      }}
                      onMarkResize={(handle, event) => beginMarkResize(event, layer, handle)}
                    />
                  </div>
                ) : sellingTemplate ? (
                  <div data-text-glyphs="1" style={{ opacity, transform: glyphFlip }}>
                    <SellingPointCard
                      mark={sellingTemplate.mark ?? "checks"}
                      text={editing ? (editDraft?.text ?? layer.text ?? "") : layer.text || "商品卖点"}
                      fontPx={fontPx}
                      editing={editing}
                      startLine={sellingLineRef.current}
                      onChange={(text) => setEditDraft({ id: layer.id, text })}
                      onCommit={(text) => {
                        const next = text.trim() ? text : IMAGE_EDITOR_TEXT_PLACEHOLDER;
                        onUpdateText(layer.id, next);
                        onEditLayer(null);
                      }}
                    />
                  </div>
                ) : shapeTemplate ? (
                  <div data-text-glyphs="1" style={{ opacity, transform: glyphFlip }}>
                    <ShapeTextArt
                      kind={shapeTemplate.kind}
                      text={editing ? (editDraft?.text ?? layer.text ?? "") : glyphText}
                      color={shapeTemplate.color}
                      bg={shapeTemplate.bg}
                      fontPx={fontPx}
                      editing={editing}
                      inputRef={editingLayerId === layer.id ? bindEdit : undefined}
                      onChange={(text) => setEditDraft({ id: layer.id, text })}
                      onCommit={(text) => {
                        const next = text.trim() ? text : IMAGE_EDITOR_TEXT_PLACEHOLDER;
                        onUpdateText(layer.id, next);
                        onEditLayer(null);
                      }}
                    />
                  </div>
                ) : warpD && warpBox ? (
                  <svg
                    data-text-glyphs="1"
                    width={warpBox.w}
                    height={warpBox.h}
                    viewBox={`0 0 ${warpBox.w} ${warpBox.h}`}
                    style={{ display: "block", transform: glyphFlip, opacity }}
                  >
                    <defs>
                      <path id={`warp-${layer.id}`} d={warpD} fill="none" />
                    </defs>
                    <text
                      fontSize={fontPx}
                      fontFamily={resolveLayerFontCss(layer)}
                      fontWeight={layer.fontWeight === "normal" ? 400 : 700}
                      fontStyle={layerExtras?.italic ? "italic" : undefined}
                      fill={svgGlyphFill(fillStyle, layer.color)}
                      textAnchor="middle"
                      style={{ textShadow: typeof fillStyle.textShadow === "string" ? fillStyle.textShadow : undefined }}
                    >
                      <textPath href={`#warp-${layer.id}`} startOffset="50%">
                        {glyphText}
                      </textPath>
                    </text>
                  </svg>
                ) : (
                <span
                  data-text-glyphs="1"
                  aria-hidden={editing}
                  style={{
                    ...fillStyle,
                    display: "block",
                    width: "100%",
                    position: "relative",
                    textAlign: distribute ? "justify" : align,
                    textAlignLast: distribute ? "justify" : undefined,
                    textJustify: distribute ? "inter-character" : undefined,
                    transform: glyphFlip,
                    opacity,
                    visibility: editing ? "hidden" : "visible",
                  }}
                >
                  {underlayShadow ? (
                    <span
                      aria-hidden
                      style={{
                        ...typeBase,
                        position: "absolute",
                        left: 0,
                        top: 0,
                        display: "block",
                        width: "100%",
                        color: "transparent",
                        textShadow: underlayShadow,
                      }}
                    >
                      {glyphText}
                    </span>
                  ) : null}
                  {glyphText}
                </span>
                )}
                {editing && !sellingTemplate && !shapeTemplate && layerExtras?.role !== "decor" ? (
                  <textarea
                    ref={editingLayerId === layer.id ? bindEdit : undefined}
                    data-text-edit="1"
                    value={editDraft?.text ?? ""}
                    rows={1}
                    cols={1}
                    spellCheck={false}
                    className="absolute inset-0 box-border block h-full w-full min-w-0 resize-none overflow-hidden border-0 bg-[#3d7eff]/25 p-0 text-current outline-none selection:bg-[#3d7eff]/45"
                    style={{
                      ...fillStyle,
                      display: "block",
                      width: "100%",
                      textAlign: distribute ? "justify" : align,
                      textAlignLast: distribute ? "justify" : undefined,
                      textJustify: distribute ? "inter-character" : undefined,
                      transform: glyphFlip,
                      opacity,
                      caretColor: layer.color ?? "#111111",
                      boxShadow: underlayShadow ? "inset 0 0 0 999px rgba(61,126,255,0.18)" : undefined,
                    }}
                    onChange={(e) => setEditDraft({ id: layer.id, text: e.target.value })}
                    onBlur={(e) => {
                      const next = e.target.value.trim() ? e.target.value : IMAGE_EDITOR_TEXT_PLACEHOLDER;
                      onUpdateText(layer.id, next);
                      onEditLayer(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : null}

                {showHandles ? (
                  <>
                    {(Object.keys(TEXT_HANDLE_POS) as TextResizeHandleId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        data-text-handle="1"
                        aria-label={`拉伸文字 ${id}`}
                        style={{ touchAction: "none" }}
                        className={cn(
                          "pointer-events-auto absolute z-30 box-border touch-none select-none rounded-[2px] border border-white bg-[#2a2420] shadow-[0_0_0_1px_rgba(42,36,32,0.35)]",
                          id === "e" || id === "w" ? "h-4 w-[6px]" : "h-2 w-2",
                          TEXT_HANDLE_CURSOR[id] === "ew-resize"
                            ? "cursor-ew-resize"
                            : TEXT_HANDLE_CURSOR[id] === "nesw-resize"
                              ? "cursor-nesw-resize"
                              : "cursor-nwse-resize",
                          TEXT_HANDLE_POS[id],
                        )}
                        onPointerDown={(ev) => beginTextResize(ev, layer, id)}
                      />
                    ))}
                    <RotateHandle
                      className="absolute bottom-0 left-1/2 translate-y-[calc(100%+10px)]"
                      disabled={disabled}
                      onPointerDown={(ev) => beginLayerRotate(ev, [layer.id])}
                    />
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {selectedGroupId && groupRect && selectedLayerId ? (
          <div
            data-text-group="1"
            className="pointer-events-none absolute z-[40] ring-2 ring-[#3d7eff]/85"
            style={{ left: groupRect.x, top: groupRect.y, width: groupRect.w, height: groupRect.h }}
          >
            <TextFloatingToolbar
              onAi={() => onAiFlower(selectedLayerId)}
              onDuplicate={() => onDuplicate(selectedLayerId)}
              onCopyStyle={() => onCopyStyle(selectedLayerId)}
              onDelete={() => onDelete(selectedLayerId)}
            />
            {(Object.keys(TEXT_HANDLE_POS) as TextResizeHandleId[]).map((id) => (
              <button
                key={id}
                type="button"
                data-text-handle="1"
                aria-label={`拉伸组合 ${id}`}
                style={{ touchAction: "none" }}
                className={cn(
                  "pointer-events-auto absolute z-30 box-border touch-none select-none rounded-[2px] border border-white bg-[#2a2420] shadow-[0_0_0_1px_rgba(42,36,32,0.35)]",
                  id === "e" || id === "w" ? "h-4 w-[6px]" : "h-2 w-2",
                  TEXT_HANDLE_CURSOR[id] === "ew-resize"
                    ? "cursor-ew-resize"
                    : TEXT_HANDLE_CURSOR[id] === "nesw-resize"
                      ? "cursor-nesw-resize"
                      : "cursor-nwse-resize",
                  TEXT_HANDLE_POS[id],
                )}
                onPointerDown={(event) => beginGroupResize(event, id)}
              />
            ))}
            <RotateHandle
              className="absolute bottom-0 left-1/2 translate-y-[calc(100%+10px)]"
              disabled={disabled}
              onPointerDown={(event) =>
                beginLayerRotate(
                  event,
                  layersSharingGroup(overlay.layers, extras, selectedGroupId).map((item) => item.id),
                )
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HoverTip({ label }: { label: string }) {
  return (
    <div data-text-chrome="1" className="pointer-events-none absolute bottom-full left-1/2 z-[45] mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ie-ink)] px-2.5 py-1 text-[11px] text-[var(--ie-cream)] shadow-md">
      {label}
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[var(--ie-ink)]" />
    </div>
  );
}

function TextFloatingToolbar({
  onAi,
  onDuplicate,
  onCopyStyle,
  onDelete,
}: {
  onAi: () => void;
  onDuplicate: () => void;
  onCopyStyle: () => void;
  onDelete: () => void;
}) {
  return (
    <div data-text-chrome="1" className="pointer-events-auto absolute bottom-full left-1/2 z-[50] mb-2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[var(--ie-border-soft)] bg-white px-1.5 py-1 shadow-md">
      <ToolbarTextBtn label="AI 花字" onClick={onAi}>
        AI
      </ToolbarTextBtn>
      <ToolbarIconBtn label="创建副本" onClick={onDuplicate}>
        <CopyPlus className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarIconBtn>
      <ToolbarIconBtn label="复制样式" onClick={onCopyStyle} showHoverTooltip>
        <Paintbrush className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarIconBtn>
      <ToolbarIconBtn label="删除" onClick={onDelete}>
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarIconBtn>
      <ToolbarIconBtn label="更多" disabled>
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarIconBtn>
    </div>
  );
}

function ToolbarTextBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md px-1 text-[11px] font-semibold tracking-wide text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-35"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

function mergeHighlight(fill: CSSProperties, highlight: CSSProperties | null): CSSProperties {
  if (!highlight) return fill;
  if (fill.backgroundImage || fill.WebkitBackgroundClip) {
    const { backgroundColor: _bg, backgroundImage: _img, backgroundSize: _size, backgroundPosition: _pos, backgroundRepeat: _repeat, ...rest } = highlight;
    return { ...fill, ...rest };
  }
  return { ...fill, ...highlight };
}

function svgGlyphFill(fill: CSSProperties, fallback: string | undefined): string {
  const color = fill.color;
  if (typeof color === "string" && color !== "transparent") return color;
  return fallback || "#111111";
}

function ToolbarIconBtn({
  children,
  label,
  disabled,
  showHoverTooltip,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  showHoverTooltip?: boolean;
  onClick?: () => void;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <span className="relative inline-flex">
      {showTip && showHoverTooltip ? (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ie-ink)] px-2 py-0.5 text-[10px] text-[var(--ie-cream)] shadow">
          {label}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-[var(--ie-ink)]" />
        </span>
      ) : null}
      <button
        type="button"
        title={label}
        disabled={disabled}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-35"
        onMouseEnter={() => showHoverTooltip && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        {children}
      </button>
    </span>
  );
}

function RotateHandle({
  className,
  disabled,
  onPointerDown,
}: {
  className: string;
  disabled?: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      data-text-handle="1"
      data-text-rotate="1"
      aria-label="旋转"
      title="旋转"
      disabled={disabled}
      style={{ touchAction: "none" }}
      className={cn(
        "pointer-events-auto z-30 inline-flex h-5 w-5 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border border-[#d8d8dc] bg-white text-[var(--ie-ink)] shadow-sm active:cursor-grabbing disabled:opacity-40",
        className,
      )}
      onPointerDown={onPointerDown}
    >
      <RotateCw className="h-3 w-3" aria-hidden />
    </button>
  );
}