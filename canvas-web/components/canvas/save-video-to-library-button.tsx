"use client";

import { useCallback, useState } from "react";
import { BookmarkPlus, Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { saveVideoToLibrary } from "@/lib/canvas-video-library";
import type { SaveVideoToLibraryInput } from "@/lib/canvas-video-library-types";
import { cn } from "@/lib/utils";

const SLOT_BTN =
  "nodrag absolute z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45";

const INLINE_BTN =
  "nodrag inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[10px] text-white/85 hover:border-emerald-400/40 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-45";

export function SaveVideoToLibraryButton({
  videoUrl,
  saveInput,
  variant = "slot",
  className,
  disabled,
}: {
  videoUrl?: string;
  saveInput: Omit<SaveVideoToLibraryInput, "sourceUrl"> | null;
  variant?: "slot" | "inline";
  className?: string;
  disabled?: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const [busy, setBusy] = useState(false);

  const onSave = useCallback(async () => {
    if (!base || !videoUrl?.trim() || !saveInput || busy) return;
    setBusy(true);
    try {
      await saveVideoToLibrary(base, {
        sourceUrl: videoUrl.trim(),
        ...saveInput,
      });
      await alert({
        title: "已保存",
        message: "视频已写入「我的视频库」，可从顶部菜单打开查看。",
        variant: "info",
      });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [alert, base, busy, saveInput, videoUrl]);

  const canSave = Boolean(base && videoUrl?.trim() && saveInput && !disabled);

  if (variant === "inline") {
    return (
      <button
        type="button"
        className={cn(INLINE_BTN, className)}
        disabled={!canSave || busy}
        onClick={(e) => {
          e.stopPropagation();
          void onSave();
        }}
        title="保存到我的视频库（转存 OSS，约保留 7 天）"
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <BookmarkPlus className="size-3" />
        )}
        保存到视频库
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(SLOT_BTN, "left-2.5 bottom-2.5", className)}
      disabled={!canSave || busy}
      onClick={(e) => {
        e.stopPropagation();
        void onSave();
      }}
      aria-label="保存到我的视频库"
      title="保存到我的视频库（转存 OSS）"
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin pointer-events-none" />
      ) : (
        <BookmarkPlus className="size-5 pointer-events-none" />
      )}
    </button>
  );
}
