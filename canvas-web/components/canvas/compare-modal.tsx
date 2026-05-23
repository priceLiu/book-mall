"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CanvasTaskRecord } from "@/lib/canvas-api";

export type CompareModalProps = {
  /** 该节点的全部 SUCCEEDED+ossUrl 任务（按时间倒序） */
  tasks: CanvasTaskRecord[];
  /** 默认左边 task id */
  defaultLeftId?: string;
  /** 默认右边 task id */
  defaultRightId?: string;
  onClose: () => void;
};

/**
 * 前后对比 modal：左右两图叠加 + 中间可拖动的滑块控制可见宽度。
 *
 * 快捷键：
 *   ←/→ 切换右图（上一张/下一张）
 *   Esc 关闭
 */
export function CompareModal({
  tasks,
  defaultLeftId,
  defaultRightId,
  onClose,
}: CompareModalProps) {
  const succeeded = useMemo(
    () => tasks.filter((t) => t.status === "SUCCEEDED" && t.ossUrl),
    [tasks],
  );
  const [leftId, setLeftId] = useState(
    defaultLeftId ?? succeeded[Math.min(succeeded.length - 1, 1)]?.id ?? succeeded[0]?.id ?? "",
  );
  const [rightId, setRightId] = useState(
    defaultRightId ?? succeeded[0]?.id ?? "",
  );
  const left = succeeded.find((t) => t.id === leftId);
  const right = succeeded.find((t) => t.id === rightId);

  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  const stepRight = useCallback(
    (delta: number) => {
      const idx = succeeded.findIndex((t) => t.id === rightId);
      if (idx < 0) return;
      const next = succeeded[idx + delta];
      if (next) setRightId(next.id);
    },
    [succeeded, rightId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepRight(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepRight(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stepRight]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-white">
          <div className="flex items-center gap-2 text-sm">
            <span>前后对比</span>
            <span className="text-[11px] text-white/50">
              ←/→ 切换 · 拖动中线 · Esc 关闭
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-2 text-[12px] text-white/80">
          <PickerPill
            label="左"
            tasks={succeeded}
            value={leftId}
            onChange={setLeftId}
          />
          <PickerPill
            label="右"
            tasks={succeeded}
            value={rightId}
            onChange={setRightId}
          />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepRight(-1)}
              className="rounded-md border border-white/10 p-1 text-white/70 hover:border-white/30 hover:text-white"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => stepRight(1)}
              className="rounded-md border border-white/10 p-1 text-white/70 hover:border-white/30 hover:text-white"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative flex-1 select-none overflow-hidden bg-black"
          onMouseDown={(e) => {
            dragging.current = true;
            onMove(e.clientX);
          }}
        >
          {right?.ossUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={right.ossUrl}
              alt="右"
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : null}
          {left?.ossUrl ? (
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${splitPct}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={left.ossUrl}
                alt="左"
                draggable={false}
                className="h-full w-full object-contain"
                style={{ width: wrapRef.current?.clientWidth ?? "100%" }}
              />
            </div>
          ) : null}
          {/* 拖动条 */}
          <div
            className="absolute inset-y-0 z-10 -ml-px w-0.5 cursor-col-resize bg-[var(--canvas-accent)]"
            style={{ left: `${splitPct}%` }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-[var(--canvas-accent)] p-1 shadow-xl">
              <div className="flex size-3 items-center gap-0.5">
                <ChevronLeft className="-mr-1 size-3 text-black" />
                <ChevronRight className="-ml-1 size-3 text-black" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickerPill({
  label,
  tasks,
  value,
  onChange,
}: {
  label: string;
  tasks: CanvasTaskRecord[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-white/70">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none"
      >
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {new Date(t.createdAt).toLocaleString()} · {t.id.slice(-6)}
          </option>
        ))}
      </select>
    </label>
  );
}
