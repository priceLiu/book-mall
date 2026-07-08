"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";

import { cn } from "@/lib/utils";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export function ImageSingleUpload({
  image,
  onChange,
  onError,
  emptyLabel = "将图片拖放到此处 或点击浏览",
  emptyHint = "JPG、PNG、WebP，最大 10MB",
  icon: Icon = CloudUpload,
  compact = false,
}: {
  image: string | null;
  onChange: (dataUrl: string | null) => void;
  onError?: (title: string, message: string) => void;
  emptyLabel?: string;
  emptyHint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** 高级选项内的小号上传区 */
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        onError?.("格式不支持", "请上传 JPG、PNG 或 WebP 图片");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        onError?.("文件过大", "图片最大 10MB");
        return;
      }
      onChange(await readFileAsDataUrl(file));
    },
    [onChange, onError],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors",
          compact ? "py-6" : "py-10 sm:py-12",
          image
            ? cn("border-[#e5e5ea]", compact ? "py-4" : "py-6")
            : dragOver
              ? "border-violet-500 bg-violet-50/40"
              : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
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
          </div>
        ) : (
          <>
            <Icon className="h-10 w-10 text-violet-500" />
            <p className="mt-3 font-medium text-[#1d1d1f]">{emptyLabel}</p>
            <p className="mt-1 text-xs text-[#6e6e73]">{emptyHint}</p>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
