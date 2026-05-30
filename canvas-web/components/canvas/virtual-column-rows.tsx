"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";

const VIRTUALIZE_THRESHOLD = 6;
const DEFAULT_OVERSCAN = 2;

export function shouldVirtualizeColumnRows(count: number): boolean {
  return count > VIRTUALIZE_THRESHOLD;
}

/**
 * 固定行高分镜/视频列虚拟列表（行数多时只渲染视口内 DOM）
 */
export function VirtualColumnRows<T>({
  items,
  rowHeight,
  gap = 12,
  className,
  getKey,
  renderRow,
}: {
  items: T[];
  rowHeight: number;
  gap?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stride = rowHeight + gap;
  const [range, setRange] = useState({ start: 0, end: items.length });

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) {
      setRange({ start: 0, end: 0 });
      return;
    }
    const start = Math.max(
      0,
      Math.floor(el.scrollTop / stride) - DEFAULT_OVERSCAN,
    );
    const visible = Math.ceil(el.clientHeight / stride) + DEFAULT_OVERSCAN * 2;
    const end = Math.min(items.length, start + visible);
    setRange((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, [items.length, stride]);

  useEffect(() => {
    recompute();
  }, [items.length, rowHeight, recompute]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  const topPad = range.start * stride;
  const bottomPad = Math.max(0, (items.length - range.end) * stride);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto pr-1",
        RF_NODE_SCROLL,
        className,
      )}
      onScroll={recompute}
    >
      <div style={{ paddingTop: topPad, paddingBottom: bottomPad }}>
        <div className="flex flex-col" style={{ gap }}>
          {items.slice(range.start, range.end).map((item, i) => {
            const index = range.start + i;
            return (
              <div
                key={getKey(item, index)}
                className="box-border w-full shrink-0 [content-visibility:auto]"
                style={{ height: rowHeight, minHeight: rowHeight }}
              >
                {renderRow(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 行数少时普通列表；多时用虚拟滚动 */
export function ColumnRowsList<T>({
  items,
  rowHeight,
  gap = 12,
  className,
  getKey,
  renderRow,
}: {
  items: T[];
  rowHeight?: number;
  gap?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => ReactNode;
}) {
  if (rowHeight && shouldVirtualizeColumnRows(items.length)) {
    return (
      <VirtualColumnRows
        items={items}
        rowHeight={rowHeight}
        gap={gap}
        className={className}
        getKey={getKey}
        renderRow={renderRow}
      />
    );
  }

  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-3 overflow-y-auto pr-1",
        RF_NODE_SCROLL,
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={getKey(item, index)}
          className="box-border w-full shrink-0 [content-visibility:auto]"
        >
          {renderRow(item, index)}
        </div>
      ))}
    </div>
  );
}
