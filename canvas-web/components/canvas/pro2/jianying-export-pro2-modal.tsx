"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { JianyingExportNodeData } from "@/lib/canvas/types";
import type { JianyingFrameExport } from "@/lib/canvas/jianying-from-workspace";
import { JianyingExportPro2Panel } from "./jianying-export-pro2-panel";

export type JianyingExportPro2ModalProps = {
  open: boolean;
  nodeId: string;
  data: JianyingExportNodeData;
  frames: JianyingFrameExport[];
  onClose: () => void;
};

/** 2.0 · 导出剪辑 · 双击节点打开 */
export function JianyingExportPro2Modal({
  open,
  nodeId,
  data,
  frames,
  onClose,
}: JianyingExportPro2ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="导出剪辑"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag flex max-h-[min(88vh,720px)] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        style={{ backgroundColor: "#212121" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/92">导出剪辑</p>
            <p className="mt-0.5 text-[11px] text-white/45">ZIP 导出 · 云端自动剪辑</p>
          </div>
          <button
            type="button"
            className="nodrag inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/[0.06] hover:text-white/85"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-3">
          <JianyingExportPro2Panel nodeId={nodeId} data={data} frames={frames} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
