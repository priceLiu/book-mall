"use client";

import type { LucideIcon } from "lucide-react";
import {
  FileText,
  ImageIcon,
  MousePointer2,
  Sparkles,
  Play,
  Video,
} from "lucide-react";

import type { LibtvCanvasEmptyShortcutId } from "@/lib/canvas/libtv-canvas-empty-shortcuts";
import { cn } from "@/lib/utils";

const SHORTCUTS: {
  id: LibtvCanvasEmptyShortcutId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "image-generate", label: "图片生成", icon: ImageIcon },
  { id: "text-to-video", label: "文生视频", icon: Play },
  { id: "image-to-video", label: "图生视频", icon: Video },
  { id: "script", label: "剧本生成", icon: FileText },
];

const CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#161618]/80 px-4 py-2 text-[13px] font-medium text-white/85 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm";

/** LibTV 空白画布 · 居中引导（双击打开添加菜单 · 底部 Dock） */
export function LibtvCanvasEmptyPaneHint({
  onShortcut,
}: {
  onShortcut: (id: LibtvCanvasEmptyShortcutId) => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center px-6"
      aria-hidden
    >
      <div className="flex w-full max-w-[720px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <span className={CHIP_CLASS}>
            <span className="relative inline-flex shrink-0">
              <MousePointer2
                className="size-4 text-white/80"
                strokeWidth={1.75}
              />
              <Sparkles
                className="absolute -right-0.5 -top-0.5 size-2.5 text-sky-400/90"
                strokeWidth={2}
              />
            </span>
            双击
          </span>
          <span className="text-center text-[14px] leading-relaxed text-white/40 sm:text-left">
            选择菜单, 开始自由创作.
          </span>
        </div>
        <div className="pointer-events-auto grid w-full max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {SHORTCUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                CHIP_CLASS,
                "justify-center transition",
                "hover:border-white/[0.14] hover:bg-[#1c1c1f] hover:text-white",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onShortcut(item.id);
              }}
            >
              <item.icon
                className="size-4 shrink-0 text-white/45"
                strokeWidth={1.75}
              />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
