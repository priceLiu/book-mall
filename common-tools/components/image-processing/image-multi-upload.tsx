"use client";

import { useCallback, useRef } from "react";
import { CloudUpload, X } from "lucide-react";

import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import {
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_DROP_HINT,
  IMAGE_UPLOAD_HINT,
  filesToDataUrls,
} from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 3;

export function ImageMultiUpload({
  images,
  onChange,
  max = MAX_IMAGES,
  emptyLabel = "将图片拖放到此处 或点击浏览",
  onError,
  disabled = false,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  emptyLabel?: string;
  onError?: (title: string, message: string) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const appendFiles = useCallback(
    async (files: File[]) => {
      const room = max - images.length;
      if (room <= 0) return;
      const urls = await filesToDataUrls(files.slice(0, room), {
        max: room,
        onError: (err) => onError?.(err.title, err.message),
      });
      if (urls.length === 0) return;
      onChange([...images, ...urls].slice(0, max));
    },
    [images, max, onChange, onError],
  );

  const { dragOver, dropZoneProps } = useImageDropPaste({
    enabled: !disabled && images.length < max,
    multiple: true,
    onFiles: appendFiles,
    onError,
  });

  const openPicker = () => {
    if (disabled || images.length >= max) return;
    fileRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || images.length >= max}
        onClick={openPicker}
        {...dropZoneProps}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-6 sm:py-10",
          images.length > 0
            ? "border-[#e5e5ea] py-4"
            : dragOver
              ? "border-violet-500 bg-violet-50/40"
              : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
          (disabled || images.length >= max) && "cursor-not-allowed opacity-60",
        )}
      >
        {images.length === 0 ? (
          <>
            <CloudUpload className="h-10 w-10 text-violet-500" />
            <p className="mt-3 font-medium">{emptyLabel}</p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              {IMAGE_UPLOAD_HINT}，最多 {max} 张 · {IMAGE_UPLOAD_DROP_HINT}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[#0071e3]">
              继续添加（{images.length}/{max}）
            </p>
            <p className="mt-1 text-[10px] text-[#86868b]">
              拖放、粘贴或点击 · {IMAGE_UPLOAD_DROP_HINT}
            </p>
          </>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        multiple={images.length < max}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void appendFiles(Array.from(list));
          e.target.value = "";
        }}
      />

      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((src, idx) => (
            <div
              key={`${idx}-${src.slice(0, 24)}`}
              className="relative overflow-hidden rounded-xl border border-[#e5e5ea] bg-[#fafafa]"
            >
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                aria-label="移除图片"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`参考图 ${idx + 1}`} className="h-40 w-full object-contain" />
              <p className="border-t border-[#e5e5ea] px-2 py-1 text-center text-xs text-[#6e6e73]">
                图 {idx + 1}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
