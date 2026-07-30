"use client";

import { useCallback, useRef } from "react";
import { CloudUpload } from "lucide-react";

import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import {
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_DROP_HINT,
  IMAGE_UPLOAD_HINT,
  readFileAsDataUrl,
  validateImageFile,
} from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";

export function ImageSingleUpload({
  image,
  onChange,
  onError,
  emptyLabel = "将图片拖放到此处 或点击浏览",
  emptyHint = IMAGE_UPLOAD_HINT,
  icon: Icon = CloudUpload,
  compact = false,
  disabled = false,
}: {
  image: string | null;
  onChange: (dataUrl: string | null) => void;
  onError?: (title: string, message: string) => void;
  emptyLabel?: string;
  emptyHint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** 高级选项内的小号上传区 */
  compact?: boolean;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const err = validateImageFile(file);
      if (err) {
        onError?.(err.title, err.message);
        return;
      }
      onChange(await readFileAsDataUrl(file));
    },
    [onChange, onError],
  );

  const { dragOver, dropZoneProps } = useImageDropPaste({
    enabled: !disabled,
    onFiles: handleFiles,
    onError,
  });

  const hint = `${emptyHint} · ${IMAGE_UPLOAD_DROP_HINT}`;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        {...dropZoneProps}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
          compact ? "py-6" : "py-10 sm:py-12",
          image
            ? cn("border-[#e5e5ea]", compact ? "py-4" : "py-6")
            : dragOver
              ? "border-violet-500 bg-violet-50/40"
              : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {image ? (
          <div className="flex w-full flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="已上传"
              className={cn(
                "rounded-lg object-contain",
                compact ? "max-h-32" : "max-h-64",
              )}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="text-xs text-[#0071e3] hover:underline"
            >
              清除图片
            </button>
            <p className="text-[10px] text-[#86868b]">可继续拖放或粘贴替换</p>
          </div>
        ) : (
          <>
            <Icon className="h-10 w-10 text-violet-500" />
            <p className="mt-3 font-medium text-[#1d1d1f]">{emptyLabel}</p>
            <p className="mt-1 text-xs text-[#6e6e73]">{hint}</p>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFiles([f]);
          e.target.value = "";
        }}
      />
    </>
  );
}
