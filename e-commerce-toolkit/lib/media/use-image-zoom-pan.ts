"use client";

/**
 * 全平台统一的图片预览「缩放 + 平移」实现。
 *
 * 规范见 `.cursor/rules/image-preview-zoom-pan.mdc`。
 * 本文件是 **规范实现（唯一事实源）**，其余子应用中的同名文件由
 * `node scripts/sync-image-zoom-pan.mjs` 逐字复制；请勿在副本里改逻辑，
 * 改这里再同步，`--check` 会在 CI 拦截漂移。
 *
 * 刻意不依赖 React 以外的任何东西（无 lucide、无 cn、无 tailwind 插件），
 * 否则副本会因各应用依赖不同而编译不过。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SyntheticEvent,
} from "react";

export const IMAGE_ZOOM_MIN = 1;
export const IMAGE_ZOOM_MAX = 6;
/** 每格滚轮的倍率；用乘法而非加法，各档位缩放手感才均匀 */
export const IMAGE_ZOOM_WHEEL_FACTOR = 1.12;
export const IMAGE_ZOOM_BUTTON_STEP = 0.5;
/** 双击在 1x 与此倍率间切换 */
export const IMAGE_ZOOM_DOUBLE_CLICK = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampImageZoom(value: number): number {
  return clamp(value, IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX);
}

type Offset = { x: number; y: number };

/**
 * 可平移范围 = 放大后超出视口的部分的一半（transform-origin 居中，两侧各分一半）。
 * 不设上限会让图片被拖出屏幕且无法凭直觉找回。
 */
function panBounds(el: HTMLElement | null, zoom: number): Offset {
  if (!el || typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: Math.max(0, (el.offsetWidth * zoom - window.innerWidth) / 2),
    y: Math.max(0, (el.offsetHeight * zoom - window.innerHeight) / 2),
  };
}

export type ImageZoomPanStageProps = {
  ref: RefObject<HTMLDivElement>;
  style: CSSProperties;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onDragStart: (e: SyntheticEvent) => void;
};

export type ImageZoomPan = {
  zoom: number;
  /** 图片已放大到超出视口，即「拖得动」 */
  pannable: boolean;
  zoomBy: (delta: number) => void;
  reset: () => void;
  /** 展开到包裹 <img> 的那层 div；控件必须留在这层之外，否则会被一起缩放 */
  stageProps: ImageZoomPanStageProps;
};

/**
 * @param resetKey 变化时归位（通常传图片 src —— 换图不该沿用上一张的缩放）
 */
export function useImageZoomPan(resetKey: string): ImageZoomPan {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(IMAGE_ZOOM_MIN);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [bounds, setBounds] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    zoomRef.current = zoom;
    offsetRef.current = offset;
  }, [zoom, offset]);

  useEffect(() => {
    setZoom(IMAGE_ZOOM_MIN);
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  const measure = useCallback(() => {
    const next = panBounds(containerRef.current, zoomRef.current);
    setBounds(next);
    setOffset((o) => {
      const x = clamp(o.x, -next.x, next.x);
      const y = clamp(o.y, -next.y, next.y);
      return x === o.x && y === o.y ? o : { x, y };
    });
  }, []);

  /** 图片异步加载，尺寸随时会变，故用 ResizeObserver 而非只在 zoom 变化时量一次 */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    zoomRef.current = zoom;
    measure();
  }, [zoom, measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // React 的 onWheel 是被动监听，无法 preventDefault，滚轮会穿透去滚背后的页面
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) =>
        clampImageZoom(
          z *
            (e.deltaY < 0
              ? IMAGE_ZOOM_WHEEL_FACTOR
              : 1 / IMAGE_ZOOM_WHEEL_FACTOR),
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const b = panBounds(containerRef.current, zoomRef.current);
    if (b.x === 0 && b.y === 0) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const b = panBounds(containerRef.current, zoomRef.current);
    setOffset({
      x: clamp(drag.ox + (e.clientX - drag.x), -b.x, b.x),
      y: clamp(drag.oy + (e.clientY - drag.y), -b.y, b.y),
    });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => clampImageZoom(z + delta));
  }, []);

  const reset = useCallback(() => {
    setZoom(IMAGE_ZOOM_MIN);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onDoubleClick = useCallback(() => {
    setZoom((z) =>
      z > IMAGE_ZOOM_MIN ? IMAGE_ZOOM_MIN : IMAGE_ZOOM_DOUBLE_CLICK,
    );
  }, []);

  const pannable = bounds.x > 0 || bounds.y > 0;

  return {
    zoom,
    pannable,
    zoomBy,
    reset,
    stageProps: {
      ref: containerRef,
      style: {
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        // 拖拽中禁用过渡，否则不跟手
        transition: dragging ? "none" : "transform 120ms ease-out",
        touchAction: pannable ? "none" : undefined,
        cursor: pannable ? (dragging ? "grabbing" : "grab") : undefined,
        userSelect: "none",
        WebkitUserSelect: "none",
      },
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      // <img> 默认可原生拖拽，dragstart 一触发浏览器就接管指针、pointermove 断流 —— 图片「拖不动」的根因
      onDragStart: (e: SyntheticEvent) => e.preventDefault(),
    },
  };
}
