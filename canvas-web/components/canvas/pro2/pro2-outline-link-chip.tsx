"use client";

import { useState } from "react";
import { AlignLeft, X } from "lucide-react";
import { createPortal } from "react-dom";
import { storyThemePromptDisplayMd } from "@/lib/canvas/story-theme-prompt-display";
import { PRO2_NODE_BORDER } from "@/lib/canvas/story-pro2-node-chrome";
import { cn } from "@/lib/utils";

export type Pro2OutlineLinkChipProps = {
  outlineMd: string;
  label?: string;
  onUnlink?: () => void;
  className?: string;
};

/** 输入坞 · 已链接故事大纲 chip（点击预览） */
export function Pro2OutlineLinkChip({
  outlineMd,
  label = "故事大纲",
  onUnlink,
  className,
}: Pro2OutlineLinkChipProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const preview = storyThemePromptDisplayMd(outlineMd);

  return (
    <>
      <button
        type="button"
        className={cn(
          "nodrag relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/35 bg-violet-500/12 text-violet-100 transition hover:bg-violet-500/22",
          className,
        )}
        title={`已链接：${label} · 点击查看`}
        onClick={() => setPreviewOpen(true)}
      >
        <AlignLeft className="size-4" />
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-semibold text-white">
          1
        </span>
      </button>

      {previewOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setPreviewOpen(false);
              }}
            >
              <div
                className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
                style={{
                  borderColor: PRO2_NODE_BORDER,
                  background:
                    "linear-gradient(165deg, rgba(24, 20, 34, 0.98) 0%, rgba(14, 12, 20, 0.99) 100%)",
                }}
              >
                <header className="flex items-center justify-between gap-2 border-b border-violet-400/12 px-4 py-3">
                  <p className="text-[13px] font-semibold text-violet-100">
                    {label}
                  </p>
                  <div className="flex items-center gap-1">
                    {onUnlink ? (
                      <button
                        type="button"
                        className="nodrag rounded-md px-2 py-1 text-[11px] text-white/50 hover:bg-white/8 hover:text-white/80"
                        onClick={() => {
                          setPreviewOpen(false);
                          onUnlink();
                        }}
                      >
                        取消链接
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="nodrag rounded-md p-1.5 text-white/50 hover:bg-white/8"
                      onClick={() => setPreviewOpen(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-white/75">
                    {preview}
                  </pre>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
