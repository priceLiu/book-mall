"use client";

import { Loader2, Plus } from "lucide-react";
import { useRef } from "react";

import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";

type Props = {
  busy?: boolean;
  onUploadFiles: (files: File[]) => void | Promise<void>;
  onError?: (title: string, message: string) => void;
  className?: string;
};

export function ImageLayerUploadZone({
  busy = false,
  onUploadFiles,
  onError,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { dragOver, pasteReady, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !busy,
    multiple: false,
    onFiles: (files) => onUploadFiles(files),
    onError,
  });

  const openPicker = () => {
    if (busy) return;
    focusZone();
    inputRef.current?.click();
  };

  return (
    <div
      {...dropZoneProps}
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed outline-none transition-colors",
        "min-h-[360px] cursor-pointer",
        dragOver
          ? "border-[#0071e3] bg-[#f0f6ff] ring-2 ring-[#0071e3]/20"
          : "border-[#d2d2d7] bg-[#fafafa] hover:border-[#0071e3]/50 hover:bg-white",
        className,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        openPicker();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label="上传图片"
      aria-busy={busy}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length && onUploadFiles) {
            void onUploadFiles(Array.from(files));
          }
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full border transition-colors",
          dragOver
            ? "border-[#0071e3] bg-[#0071e3] text-white"
            : "border-[#d2d2d7] bg-white text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3]",
          busy && "opacity-60",
        )}
        aria-label="选择图片文件"
      >
        {busy ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <Plus className="h-8 w-8" strokeWidth={1.5} />
        )}
      </button>

      <p className="mt-4 text-sm font-medium text-[#1d1d1f]">
        {dragOver ? "松开以上传" : busy ? "处理中…" : "点击或拖入图片"}
      </p>
      <p className="mt-1 text-xs text-[#86868b]">
        {pasteReady ? "支持 Ctrl+V / ⌘V 粘贴 · png / jpeg" : "支持拖放、粘贴 · png / jpeg"}
      </p>
      <p className="mt-3 text-[11px] text-[#aeaeb2]">
        载入后请手动点击「AI 图层分离」
      </p>
    </div>
  );
}
