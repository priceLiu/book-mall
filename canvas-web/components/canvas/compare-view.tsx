"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CompareSideOption } from "./compare-utils";

function CompareSidePicker({
  label,
  options,
  value,
  onChange,
  onStep,
}: {
  label: string;
  options: CompareSideOption[];
  value: string;
  onChange: (id: string) => void;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1">
      <label className="inline-flex min-w-0 items-center gap-1">
        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[min(200px,28vw)] rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="shrink-0 rounded-md border border-white/10 p-1 text-white/70 hover:border-white/30 hover:text-white"
        aria-label={`上一张${label}`}
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        className="shrink-0 rounded-md border border-white/10 p-1 text-white/70 hover:border-white/30 hover:text-white"
        aria-label={`下一张${label}`}
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

/** 单行工具栏：左图 / 右图选择（供顶栏与对比弹层复用） */
export function CompareToolbar({
  options,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
}: {
  options: CompareSideOption[];
  leftId: string;
  rightId: string;
  onLeftChange: (id: string) => void;
  onRightChange: (id: string) => void;
}) {
  const stepSide = useCallback(
    (side: "left" | "right", delta: number) => {
      const currentId = side === "left" ? leftId : rightId;
      const idx = options.findIndex((o) => o.id === currentId);
      if (idx < 0) return;
      const next = options[idx + delta];
      if (!next) return;
      if (side === "left") onLeftChange(next.id);
      else onRightChange(next.id);
    },
    [options, leftId, rightId, onLeftChange, onRightChange],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/80">
      <CompareSidePicker
        label="左图"
        options={options}
        value={leftId}
        onChange={onLeftChange}
        onStep={(d) => stepSide("left", d)}
      />
      <CompareSidePicker
        label="右图"
        options={options}
        value={rightId}
        onChange={onRightChange}
        onStep={(d) => stepSide("right", d)}
      />
    </div>
  );
}

/** 重叠 + 中线滑块对比 */
function CompareSliderPane({
  left,
  right,
}: {
  left: CompareSideOption;
  right: CompareSideOption;
}) {
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSplitPct(50);
  }, [left.url, right.url]);

  const onMove = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onMove(e.clientX);
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMove]);

  const rightClip = 100 - splitPct;

  return (
    <div
      ref={wrapRef}
      className="relative min-h-0 flex-1 select-none overflow-hidden rounded-xl border border-white/10 bg-black"
      style={{ minHeight: "calc(100dvh - 120px)" }}
      onMouseDown={(e) => {
        dragging.current = true;
        onMove(e.clientX);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={right.url}
        alt={right.label}
        draggable={false}
        className="pointer-events-none absolute inset-0 m-auto h-full w-full object-contain object-center"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={left.url}
        alt={left.label}
        draggable={false}
        className="pointer-events-none absolute inset-0 m-auto h-full w-full object-contain object-center"
        style={{ clipPath: `inset(0 ${rightClip}% 0 0)` }}
      />
      <div
        className="absolute inset-y-0 z-10 w-0.5 cursor-col-resize bg-[var(--canvas-accent)]"
        style={{ left: `${splitPct}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-[var(--canvas-accent)] p-1.5 shadow-xl">
          <div className="flex items-center gap-0.5">
            <ChevronLeft className="-mr-1 size-4 text-black" />
            <ChevronRight className="-ml-1 size-4 text-black" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 对比滑块区域（不含顶栏，顶栏由父组件单行布局） */
export function CompareSplitView({
  options,
  leftId,
  rightId,
}: {
  options: CompareSideOption[];
  leftId: string;
  rightId: string;
  onLeftChange?: (id: string) => void;
  onRightChange?: (id: string) => void;
}) {
  const left = options.find((o) => o.id === leftId);
  const right = options.find((o) => o.id === rightId);

  if (!left?.url || !right?.url) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CompareSliderPane left={left} right={right} />
    </div>
  );
}

export function useCompareSides(
  options: CompareSideOption[],
  defaults: { leftId: string; rightId: string },
) {
  const [leftId, setLeftId] = useState(defaults.leftId);
  const [rightId, setRightId] = useState(defaults.rightId);

  useEffect(() => {
    setLeftId(defaults.leftId);
    setRightId(defaults.rightId);
  }, [defaults.leftId, defaults.rightId]);

  const stepRight = useCallback(
    (delta: number) => {
      const idx = options.findIndex((o) => o.id === rightId);
      if (idx < 0) return;
      const next = options[idx + delta];
      if (next) setRightId(next.id);
    },
    [options, rightId],
  );

  return { leftId, rightId, setLeftId, setRightId, stepRight };
}
