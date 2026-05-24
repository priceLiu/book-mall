"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  buildSideOptions,
  defaultCompareSides,
  type CompareReferenceImage,
  refSideId,
  taskSideId,
} from "./compare-utils";
import { CompareSplitView, CompareToolbar, useCompareSides } from "./compare-view";

export type CompareModalProps = {
  tasks: CanvasTaskRecord[];
  referenceImages?: CompareReferenceImage[];
  defaultLeftId?: string;
  defaultRightId?: string;
  onClose: () => void;
};

export type { CompareReferenceImage } from "./compare-utils";
export { refSideId, taskSideId } from "./compare-utils";

/** 全屏遮罩对比（节点工具栏「对比」按钮入口） */
export function CompareModal({
  tasks,
  referenceImages = [],
  defaultLeftId,
  defaultRightId,
  onClose,
}: CompareModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options = useMemo(
    () => buildSideOptions(tasks, referenceImages),
    [tasks, referenceImages],
  );

  const defaults = useMemo(
    () =>
      defaultCompareSides(options, defaultLeftId, defaultRightId),
    [options, defaultLeftId, defaultRightId],
  );

  const { leftId, rightId, setLeftId, setRightId, stepRight } =
    useCompareSides(options, defaults);

  useEffect(() => {
    document.body.style.overflow = "hidden";
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
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, stepRight]);

  if (!mounted || options.length < 2) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-black/94 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="图片对比"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <CompareToolbar
          options={options}
          leftId={leftId}
          rightId={rightId}
          onLeftChange={setLeftId}
          onRightChange={setRightId}
        />
        <button
          type="button"
          onClick={onClose}
          className="ml-auto shrink-0 rounded-full border border-white/10 p-1.5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"
          aria-label="关闭对比"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <CompareSplitView
          options={options}
          leftId={leftId}
          rightId={rightId}
        />
      </div>
    </div>,
    document.body,
  );
}
